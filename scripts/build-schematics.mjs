// Compiles a published package's `ng add` schematic into its dist folder:
//
//   node scripts/build-schematics.mjs ngx-json-render
//
// ng-packagr builds the Angular library and cleans `dist/<package>` first, so
// this runs after it (see `build:lib` and `build:material`). The schematic is
// CommonJS, which the Angular CLI loads with `require`, while ng-packagr marks
// the whole package `"type": "module"`. The sources are therefore `.cts` and
// compile to `.cjs`: a nested `{ "type": "commonjs" }` package.json would say
// the same, but `npm pack` leaves nested package.json files out of the tarball.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';

const name = process.argv[2];
if (!name) {
  console.error('usage: node scripts/build-schematics.mjs <package>');
  process.exit(2);
}

const src = join('projects', name, 'schematics');
const out = join('dist', name, 'schematics');
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');

rmSync(out, { recursive: true, force: true });
execFileSync(process.execPath, [tsc, '-p', join(src, 'tsconfig.json')], {
  stdio: 'inherit',
});

/** Every `.json` under `dir` except the tsconfig, which is build input only. */
function jsonFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return jsonFiles(path);
    return entry.name.endsWith('.json') && entry.name !== 'tsconfig.json'
      ? [path]
      : [];
  });
}

for (const file of jsonFiles(src)) {
  const target = join(out, relative(src, file));
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(file, target);
}
console.log(`Built ${name} schematics into ${out}`);
