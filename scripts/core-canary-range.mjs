#!/usr/bin/env node
/**
 * Prints the GITHUB_OUTPUT lines the core canary's range step needs: the
 * peer range on @json-render/core of every published package, and whether
 * the given version is admitted by all of them.
 *
 * Every library manifest counts. `check:peers` polices only the ranges
 * between siblings, so a range widened in one manifest and forgotten in the
 * other would install fine here and ERESOLVE for a user following the
 * catalog's README — the class of failure the canary exists to catch.
 *
 * Usage: node scripts/core-canary-range.mjs <version>
 * Output (stdout): `range=<ranges>` and `admitted=true|false`; one line per
 * manifest on stderr.
 */
import { existsSync, readFileSync } from 'node:fs';
import semver from 'semver';

const version = process.argv[2];
if (!version || !semver.valid(version)) {
  console.error(
    `usage: node scripts/core-canary-range.mjs <version> (got ${JSON.stringify(version)})`,
  );
  process.exit(2);
}

const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const ranges = Object.values(read('angular.json').projects)
  .filter((project) => project.projectType === 'library')
  .map((project) => `${project.root}/package.json`)
  .filter((path) => existsSync(path))
  .map((path) => ({ path, ...read(path) }))
  .map((pkg) => ({
    name: pkg.name,
    range: pkg.peerDependencies?.['@json-render/core'],
  }))
  .filter((entry) => entry.range);

if (ranges.length === 0) {
  console.error(
    'No library manifest declares a peer range on @json-render/core.',
  );
  process.exit(2);
}

for (const { name, range } of ranges) {
  console.error(
    `${name}: ${range} ${semver.satisfies(version, range) ? 'admits' : 'excludes'} ${version}`,
  );
}
console.log(`range=${[...new Set(ranges.map((r) => r.range))].join(' / ')}`);
console.log(
  `admitted=${ranges.every((r) => semver.satisfies(version, r.range))}`,
);
