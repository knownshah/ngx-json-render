import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const script = new URL('../core-canary-range.mjs', import.meta.url).pathname;
const run = (version) =>
  spawnSync(process.execPath, [script, version], {
    cwd: new URL('../..', import.meta.url).pathname,
    encoding: 'utf8',
  });

test('the pinned core is admitted by every manifest', () => {
  const pinned = JSON.parse(
    readFileSync(
      new URL(
        '../../node_modules/@json-render/core/package.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ).version;
  const r = run(pinned);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^range=.+\n/);
  assert.match(r.stdout, /\nadmitted=true\n$/);
  // one line per published package, both admitting
  assert.equal((r.stderr.match(/ admits /g) || []).length, 2, r.stderr);
});

test('a core no manifest admits is reported as not admitted', () => {
  const r = run('99.0.0');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /\nadmitted=false\n$/);
});

test('a version that is not a version is refused', () => {
  assert.equal(run('latest').status, 2);
  assert.equal(run('').status, 2);
});
