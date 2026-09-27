/**
 * Dry-runs scripts/core-canary-report.sh with a stubbed `gh` on PATH, so the
 * decision the canary makes — close, open, leave alone — is tested without a
 * repository, the way resolution-verdict.test.mjs tests the release verdicts.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const script = new URL('../core-canary-report.sh', import.meta.url).pathname;

/** Runs the script with a `gh` stub whose `issue list` answers `openIssues`. */
function run({ admitted, outcomes, openIssues = [] }) {
  const dir = mkdtempSync(join(tmpdir(), 'canary-'));
  const log = join(dir, 'gh.log');
  writeFileSync(
    join(dir, 'gh'),
    `#!/usr/bin/env bash
printf '%s\n' "$(printf '%s' "$*" | tr '\n' ' ')" >> "${log}"
if [ "$1 $2" = "issue list" ]; then
  printf '%s' '${JSON.stringify(openIssues)}' | node -e '
    const issues = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const jq = process.argv[1];
    if (jq === ".[].number") issues.forEach((i) => console.log(i.number));
    else { const m = jq.match(/contains\\("([^"]+)"\\)/); issues.filter((i) => i.title.includes(m[1])).forEach((i) => console.log(i.number)); }
  ' "$(printf '%s\\n' "$@" | grep -A0 -- '--jq' -m1 >/dev/null; for a in "$@"; do :; done; echo "\${@: -1}")"
fi
exit 0
`,
  );
  chmodSync(join(dir, 'gh'), 0o755);
  const result = spawnSync('bash', [script], {
    env: {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      GH_TOKEN: 'stub',
      LATEST: '0.22.0',
      RANGE: '>=0.20.0 <0.22.0',
      PINNED: '0.21.0',
      ADMITTED: admitted ? 'true' : 'false',
      OUTCOMES: outcomes,
      RUN_URL: 'https://example.invalid/run/1',
    },
    encoding: 'utf8',
  });
  let calls = [];
  try {
    calls = readFileSync(log, 'utf8').trim().split('\n').filter(Boolean);
  } catch {}
  rmSync(dir, { recursive: true, force: true });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    calls,
  };
}

const allGreen =
  'install=success build_lib=success test_lib=success build_material=success test_material=success';
const libRed =
  'install=success build_lib=success test_lib=failure build_material=success test_material=success';

test('admitted and green: exits 0 and closes what the canary opened', () => {
  const r = run({
    admitted: true,
    outcomes: allGreen,
    openIssues: [
      {
        number: 7,
        title:
          'core canary: @json-render/core 0.22.0 is outside >=0.20.0 <0.22.0',
      },
    ],
  });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(
    r.calls.some((c) => c.startsWith('issue close 7 ')),
    r.calls.join('\n'),
  );
  assert.ok(
    !r.calls.some((c) => c.startsWith('issue create')),
    r.calls.join('\n'),
  );
});

test('admitted and green with nothing open: exits 0 and touches nothing', () => {
  const r = run({ admitted: true, outcomes: allGreen });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(
    !r.calls.some(
      (c) => c.startsWith('issue close') || c.startsWith('issue create'),
    ),
    r.calls.join('\n'),
  );
});

test('not admitted: exits 1 and opens the "outside the range" issue', () => {
  const r = run({ admitted: false, outcomes: allGreen });
  assert.equal(r.status, 1);
  const create = r.calls.find((c) => c.startsWith('issue create'));
  assert.ok(create, r.calls.join('\n'));
  assert.match(create, /is outside >=0\.20\.0 <0\.22\.0/);
  assert.match(create, /admitting it is a manifest change/);
});

test('admitted but red: exits 1 and opens the "suite fails" issue naming the step', () => {
  const r = run({ admitted: true, outcomes: libRed });
  assert.equal(r.status, 1);
  const create = r.calls.find((c) => c.startsWith('issue create'));
  assert.ok(create, r.calls.join('\n'));
  assert.match(create, /the suite fails against @json-render\/core 0\.22\.0/);
  assert.match(create, /these steps failed: test_lib/);
});

test('not admitted with the issue already open: exits 1 without a duplicate', () => {
  const r = run({
    admitted: false,
    outcomes: allGreen,
    openIssues: [
      {
        number: 9,
        title:
          'core canary: @json-render/core 0.22.0 is outside >=0.20.0 <0.22.0',
      },
    ],
  });
  assert.equal(r.status, 1);
  assert.ok(
    !r.calls.some((c) => c.startsWith('issue create')),
    r.calls.join('\n'),
  );
});

test('a skipped step after a failure is not reported twice', () => {
  const r = run({
    admitted: true,
    outcomes:
      'install=success build_lib=failure test_lib=skipped build_material=skipped test_material=skipped',
  });
  assert.equal(r.status, 1);
  const create = r.calls.find((c) => c.startsWith('issue create'));
  assert.match(create, /these steps failed: build_lib \(/);
});
