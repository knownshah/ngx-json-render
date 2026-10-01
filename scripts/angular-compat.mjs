/**
 * Prepares the workspace to build and test the library against an Angular
 * line other than the one `package.json` pins, so CI can prove the `>=19`
 * peer range in `projects/ngx-json-render/package.json` still holds at both
 * ends: the floor it promises, and the newest line a consumer can be on.
 *
 * Angular 19 has no unit-test builder, so on that line CI only builds the
 * library; `scripts/consumer-smoke.mjs` covers it at run time instead. The
 * Material catalog keeps a `>=20` floor of its own and is not built on 19.
 *
 * Usage: node scripts/angular-compat.mjs 19
 *        node scripts/angular-compat.mjs 20
 *        node scripts/angular-compat.mjs 22
 */
import { readFileSync, writeFileSync } from 'node:fs';

const major = process.argv[2];
if (!/^\d+$/.test(major ?? '')) {
  console.error('usage: node scripts/angular-compat.mjs <angular-major>');
  process.exit(1);
}

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const write = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + '\n');

const pkg = read('package.json');
for (const name of Object.keys(pkg.dependencies)) {
  if (name.startsWith('@angular/')) pkg.dependencies[name] = `^${major}.0.0`;
}
for (const name of Object.keys(pkg.devDependencies)) {
  if (name.startsWith('@angular/') || name === 'ng-packagr') {
    pkg.devDependencies[name] = `^${major}.0.0`;
  }
}
if (major === '22') {
  // Angular 22 peers on TypeScript 6.0 exactly (`>=6.0 <6.1`), so the
  // workspace's ~5.9 pin ERESOLVEs before anything gets a chance to compile.
  pkg.devDependencies.typescript = '~6.0.0';
}
if (major === '19') {
  // Angular 19 peers on TypeScript <5.9. 5.7 would do for Angular, but not for
  // this source: it cannot narrow `step` in element.component.ts's
  // `repeatsItself` loop and reports it as possibly null.
  pkg.devDependencies.typescript = '~5.8.0';
}
if (major === '20') {
  // @angular/build@20 declares a peer of vitest ^3.1.1; vitest 4 fails ERESOLVE.
  // The coverage provider peers on its own major, so it has to move with
  // vitest — pinning one and not the other trades this conflict for that one.
  pkg.devDependencies.vitest = '^3.2.0';
  pkg.devDependencies['@vitest/coverage-v8'] = '^3.2.0';
  pkg.devDependencies.typescript = '~5.8.0';
}
write('package.json', pkg);

if (major === '20') {
  // The v20 unit-test builder requires `buildTarget` and `runner`; v21 infers both.
  const ng = read('angular.json');
  for (const project of Object.values(ng.projects)) {
    const test = project.architect?.test;
    if (!test) continue;
    test.options = {
      ...test.options,
      buildTarget: 'demo:build',
      runner: 'vitest',
    };
    // The v20 builder's schema rejects unknown options outright, and the
    // coverage settings are v21-only. This job proves the library still
    // compiles and passes on v20; the thresholds are enforced by the main
    // job, which runs on the version the workspace actually pins.
    delete test.options.coverageInclude;
    delete test.options.coverageExclude;
    delete test.options.coverageThresholds;
  }
  write('angular.json', ng);
}

if (major === '19') {
  // The v19 ng-packagr builder requires `project`; v20 onwards default it to
  // the project's own ng-package.json.
  const ng = read('angular.json');
  for (const project of Object.values(ng.projects)) {
    const build = project.architect?.build;
    if (!build?.builder.endsWith(':ng-packagr')) continue;
    build.options = {
      project: `${project.root}/ng-package.json`,
      ...build.options,
    };
  }
  write('angular.json', ng);
}

console.log(`Workspace retargeted to Angular ${major}.`);
