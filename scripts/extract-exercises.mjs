// scripts/extract-exercises.mjs
// Reads app_file.json from APK extraction, outputs cleaned data/exercises.json
// Usage: node scripts/extract-exercises.mjs <path-to-app_file.json>
import { readFileSync, writeFileSync } from 'fs';

const inputPath =
  process.argv[2] ?? '/tmp/mf-apk/assets/flutter_assets/packages/macrofactor/assets/import/app_file.json';
const raw = JSON.parse(readFileSync(inputPath, 'utf8'));

const output = {
  generatedAt: raw.generatedAt,
  exercises: raw.exercises,
  uuidIndex: raw.uuidIndex,
};

writeFileSync('data/exercises.json', JSON.stringify(output));
console.log(`Wrote ${output.exercises.length} exercises, ${Object.keys(output.uuidIndex).length} index entries`);
