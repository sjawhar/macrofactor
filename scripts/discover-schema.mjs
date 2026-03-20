// scripts/discover-schema.mjs
// Discovers Firestore schema by sampling documents from all known collections.
// Outputs JSON samples to data/samples/ and optionally generates TypeScript types.
//
// Usage: node scripts/discover-schema.mjs

import { readFileSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';

// Load env
try {
  const env = readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.startsWith('MACROFACTOR_USERNAME=')) process.env.MACROFACTOR_USERNAME = line.substring(21).trim();
    if (line.startsWith('MACROFACTOR_PASSWORD=')) process.env.MACROFACTOR_PASSWORD = line.substring(21).trim();
  }
} catch (e) {}

const email = process.env.MACROFACTOR_USERNAME;
const password = process.env.MACROFACTOR_PASSWORD;
if (!email || !password) {
  console.error('Set MACROFACTOR_USERNAME and MACROFACTOR_PASSWORD in .env');
  process.exit(1);
}

// Minimal implementations to avoid needing tsx to run this script
const FIREBASE_WEB_API_KEY = 'AIzaSyA17Uwy37irVEQSwz6PIyX3wnkHrDBeleA';
const PROJECT_ID = 'sbs-diet-app';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function signIn(email, password) {
  const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Ios-Bundle-Identifier': 'com.sbs.diet' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!resp.ok) throw new Error(`Sign-in failed`);
  return resp.json();
}

function parseValue(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return val.doubleValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return val.timestampValue;
  if ('mapValue' in val) {
    const result = {};
    for (const [k, v] of Object.entries(val.mapValue?.fields ?? {})) result[k] = parseValue(v);
    return result;
  }
  if ('arrayValue' in val) return (val.arrayValue?.values ?? []).map(parseValue);
  return val;
}

function parseFields(fields) {
  const result = {};
  for (const [k, v] of Object.entries(fields || {})) result[k] = parseValue(v);
  return result;
}

async function getDocument(path, idToken) {
  const resp = await fetch(`${BASE_URL}/${path}`, { headers: { Authorization: `Bearer ${idToken}` } });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`GET ${path} failed: ${resp.status}`);
  const doc = await resp.json();
  return { id: doc.name?.split('/').pop(), ...parseFields(doc.fields) };
}

async function listDocuments(path, idToken, limit = 5) {
  const resp = await fetch(`${BASE_URL}/${path}?pageSize=${limit}`, { headers: { Authorization: `Bearer ${idToken}` } });
  if (resp.status === 404) return [];
  if (!resp.ok) throw new Error(`LIST ${path} failed: ${resp.status}`);
  const data = await resp.json();
  return (data.documents ?? []).map(d => ({
    id: d.name?.split('/').pop(),
    ...parseFields(d.fields)
  }));
}

const COLLECTIONS = [
  { path: 'workoutHistory', type: 'list', name: 'workoutHistory' },
  { path: 'gym', type: 'list', name: 'gym' },
  { path: 'customExercises', type: 'list', name: 'customExercises' },
  { path: 'programs', type: 'list', name: 'programs' },
  { path: `body/${new Date().getFullYear()}`, type: 'doc', name: 'bodyMeasurements' },
  { path: '', type: 'doc', name: 'userProfile' },
];

async function main() {
  console.log('Authenticating...');
  const { idToken, localId } = await signIn(email, password);
  console.log(`Authenticated as ${localId}`);

  mkdirSync('data/samples', { recursive: true });

  for (const col of COLLECTIONS) {
    const fullPath = `users/${localId}${col.path ? '/' + col.path : ''}`;
    console.log(`\nFetching ${fullPath}...`);
    
    let data;
    if (col.type === 'list') {
      data = await listDocuments(fullPath, idToken);
    } else {
      const doc = await getDocument(fullPath, idToken);
      data = doc ? [doc] : [];
    }

    if (data.length > 0) {
      const outPath = `data/samples/${col.name}.json`;
      await writeFile(outPath, JSON.stringify(data, null, 2));
      console.log(`✅ Saved ${data.length} records to ${outPath}`);
      
      // Print high-level schema of first record
      const first = data[0];
      const keys = Object.keys(first);
      console.log(`   Fields: ${keys.slice(0, 10).join(', ')}${keys.length > 10 ? '...' : ''}`);
    } else {
      console.log(`❌ No data found`);
    }
  }

  console.log('\nDiscovery complete. Samples saved to data/samples/.');
  console.log('To generate TypeScript types, run:');
  console.log('npx quicktype data/samples/workoutHistory.json --lang typescript --just-types');
}

main().catch(console.error);
