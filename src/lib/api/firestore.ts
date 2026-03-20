const PROJECT_ID = 'sbs-diet-app';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export interface FirestoreDocument {
  name?: string;
  fields?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  createTime?: string;
  updateTime?: string;
}

// ---------------------------------------------------------------------------
// Read / write
// ---------------------------------------------------------------------------

export async function getDocument(path: string, idToken: string): Promise<FirestoreDocument> {
  const resp = await fetch(`${BASE_URL}/${path}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (resp.status === 404) return {};
  if (!resp.ok) {
    throw new Error(`Firestore GET ${path} failed (${resp.status}): ${await resp.text()}`);
  }
  return resp.json();
}

export async function listDocuments(
  collectionPath: string,
  idToken: string,
  pageSize = 100
): Promise<FirestoreDocument[]> {
  const allDocs: FirestoreDocument[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ pageSize: String(pageSize) });
    if (pageToken) params.set('pageToken', pageToken);
    const url = `${BASE_URL}/${collectionPath}?${params}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (resp.status === 404) break;
    if (!resp.ok) {
      throw new Error(`Firestore LIST ${collectionPath} failed (${resp.status}): ${await resp.text()}`);
    }
    const data = await resp.json();
    if (data.documents) allDocs.push(...data.documents);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allDocs;
}

export async function patchDocument(
  path: string,
  fields: Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  fieldPaths: string[],
  idToken: string
): Promise<FirestoreDocument> {
  const mask = fieldPaths
    .map((fp) => `updateMask.fieldPaths=${encodeURIComponent(fp)}`)
    .join('&');
  const url = `${BASE_URL}/${path}?${mask}`;
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ fields: toFirestoreFields(fields) }),
  });
  if (!resp.ok) {
    throw new Error(`Firestore PATCH ${path} failed (${resp.status}): ${await resp.text()}`);
  }
  return resp.json();
}

export async function listCollectionIds(
  parentPath: string | null,
  idToken: string
): Promise<string[]> {
  const parent = parentPath ? `${BASE_URL}/${parentPath}` : BASE_URL;
  const resp = await fetch(`${parent}:listCollectionIds`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({}),
  });
  if (!resp.ok) {
    throw new Error(
      `Firestore listCollectionIds failed (${resp.status}): ${await resp.text()}`
    );
  }
  const data = await resp.json();
  return data.collectionIds ?? [];
}

// ---------------------------------------------------------------------------
// JS → Firestore value conversion (generic — uses native numeric types)
// ---------------------------------------------------------------------------

export function toFirestoreValue(val: any): any { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val)
      ? { integerValue: String(val) }
      : { doubleValue: val };
  }
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    return { mapValue: { fields: toFirestoreFields(val) } };
  }
  return { stringValue: String(val) };
}

export function toFirestoreFields(
  obj: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
): Record<string, any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const fields: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) fields[key] = toFirestoreValue(val);
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Food-entry serialization (string-typed — matches Android app expectations)
// ---------------------------------------------------------------------------
// The MacroFactor Android app stores ALL food entry values as stringValue,
// booleanValue, or nullValue — never integerValue / doubleValue.
// Using toFirestoreValue() for food entries produces entries that crash the
// app.  These types and helpers make it structurally impossible to write a
// food entry with wrong Firestore types.
// ---------------------------------------------------------------------------

/** A Firestore value that the MacroFactor app can safely parse. */
export type FoodFieldValue =
  | { stringValue: string }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values: Array<{ mapValue: { fields: Record<string, FoodFieldValue> } }> } };

/**
 * String-typed field — the only numeric encoding the app accepts.
 * Integer values get a `.0` suffix to match the app's format
 * (e.g., `1` → `"1.0"`, `150` → `"150.0"`).
 */
export function sfv(v: string | number): FoodFieldValue {
  if (typeof v === 'number' && Number.isInteger(v)) {
    return { stringValue: v.toFixed(1) };
  }
  return { stringValue: String(v) };
}

export function bfv(v: boolean): FoodFieldValue {
  return { booleanValue: v };
}

export function nfv(): FoodFieldValue {
  return { nullValue: null };
}

/** Build the `m` (measurements/servings) array in the format the app expects. */
export function servingsArray(
  servings: { description: string; gramWeight: number; amount: number }[]
): FoodFieldValue {
  return {
    arrayValue: {
      values: servings.map((s) => ({
        mapValue: {
          fields: {
            m: sfv(s.description) as { stringValue: string },
            w: sfv(s.gramWeight) as { stringValue: string },
            q: sfv(s.amount) as { stringValue: string },
          },
        },
      })),
    },
  };
}

/**
 * Patch a Firestore food document using pre-built FoodFieldValue fields.
 * Unlike patchDocument (which calls toFirestoreFields and coerces JS numbers
 * to integerValue/doubleValue), this sends the fields exactly as given.
 */
export async function patchFoodDocument(
  path: string,
  entryId: string,
  fields: Record<string, FoodFieldValue>,
  idToken: string
): Promise<void> {
  const escapedPath = '`' + entryId + '`';
  const url = `${BASE_URL}/${path}?updateMask.fieldPaths=${encodeURIComponent(escapedPath)}`;
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      fields: {
        [entryId]: { mapValue: { fields } },
      },
    }),
  });
  if (!resp.ok) {
    throw new Error(`Firestore PATCH food ${path} failed (${resp.status}): ${await resp.text()}`);
  }
}

/**
 * Update specific fields within an existing food entry WITHOUT replacing
 * the entire entry.  Uses per-subfield update masks so only the listed
 * fields are touched; all other fields in the entry are preserved.
 *
 * patchFoodDocument replaces the ENTIRE entry (correct for creation).
 * This function is for partial updates like delete-flag or quantity change.
 */
export async function updateFoodEntryFields(
  path: string,
  entryId: string,
  fields: Record<string, FoodFieldValue>,
  idToken: string
): Promise<void> {
  const escaped = '`' + entryId + '`';
  const mask = Object.keys(fields)
    .map((f) => `updateMask.fieldPaths=${encodeURIComponent(escaped + '.' + f)}`)
    .join('&');
  const url = `${BASE_URL}/${path}?${mask}`;
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      fields: {
        [entryId]: { mapValue: { fields } },
      },
    }),
  });
  if (!resp.ok) {
    throw new Error(`Firestore update food fields ${path} failed (${resp.status}): ${await resp.text()}`);
  }
}

// ---------------------------------------------------------------------------
// Firestore value → JS conversion
// ---------------------------------------------------------------------------

export function parseFirestoreValue(val: any): any { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (val == null) return null;
  if ('stringValue' in val) return val.stringValue as string;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return val.doubleValue as number;
  if ('booleanValue' in val) return val.booleanValue as boolean;
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return val.timestampValue as string;
  if ('referenceValue' in val) return val.referenceValue as string;
  if ('mapValue' in val) return parseFirestoreFields(val.mapValue?.fields ?? {});
  if ('arrayValue' in val) {
    return (val.arrayValue?.values ?? []).map(parseFirestoreValue);
  }
  return null;
}

export function parseFirestoreFields(
  fields: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
): Record<string, any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const result: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!fields) return result;
  for (const [key, val] of Object.entries(fields)) {
    result[key] = parseFirestoreValue(val);
  }
  return result;
}

export function parseDocument(doc: FirestoreDocument): Record<string, any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!doc.fields) return {};
  return parseFirestoreFields(doc.fields);
}
