// Drives both built apps through the same scenarios in one headless Chromium.
// Usage: node run.mjs [--sizes 100,1000,4000] [--rounds 2] [--only stream,mount]
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'node:fs';
import { serve } from './serve.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')),
);
const SIZES = (args.sizes ?? '100,1000,4000').split(',').map(Number);
const ROUNDS = Number(args.rounds ?? 2);
const ONLY = args.only ? args.only.split(',') : null;
const OUT = args.out ?? new URL('../results/', import.meta.url).pathname;

const APPS = {
  react: new URL('../react-bench/dist/', import.meta.url).pathname,
  angular: new URL('../angular-bench/dist/browser/', import.meta.url).pathname,
};

// scenario -> reps per size (each scenario already reports the median of reps)
const PLAN = [
  ['mount', 7],
  ['mountDeep', 7],
  ['patchLeaf', 9],
  ['patchLeafDeep', 9],
  ['sameSpec', 9],
  ['stateOne', 9],
  ['stateAll', 7],
  ['repeatAppend', 7],
  ['unmount', 7],
  ['stream', 1],
  ['streamChunked', 1],
  ['plainMount', 7],
  ['plainMountDeep', 7],
  ['plainPatchLeaf', 9],
  ['plainSameTree', 9],
  ['plainUnmount', 7],
];

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

async function openApp(browser, url) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('  [pageerror]', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning')
      console.error('  [console]', m.text());
  });
  await page.goto(url);
  await page.waitForFunction(() => window.benchReady === true);
  return page;
}

async function memoryProbe(context, page, size, mountFn = 'mountSize') {
  const cdp = await context.newCDPSession(page);
  await cdp.send('HeapProfiler.enable');
  const heap = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    await cdp.send('HeapProfiler.collectGarbage');
    const { metrics } = await cdp.send('Performance.getMetrics');
    return metrics.find((m) => m.name === 'JSHeapUsedSize').value;
  };
  await cdp.send('Performance.enable');
  const before = await heap();
  const t0 = Date.now();
  await page.evaluate(([s, fn]) => window.bench[fn](s), [size, mountFn]);
  const mounted = await heap();
  await page.evaluate(
    (fn) => window.bench[fn === 'mountTreeSize' ? 'unmountTree' : 'unmount'](),
    mountFn,
  );
  const after = await heap();
  await cdp.detach();
  return {
    before,
    mounted,
    after,
    treeBytes: mounted - before,
    retainedBytes: after - before,
  };
}

const browser = await chromium.launch({
  args: ['--js-flags=--expose-gc', '--enable-precise-memory-info'],
});
const results = {
  meta: {
    date: new Date().toISOString(),
    sizes: SIZES,
    rounds: ROUNDS,
    chromium: browser.version(),
    ua: null,
  },
  runs: [],
  memory: {},
};
mkdirSync(OUT, { recursive: true });

const servers = {};
for (const [name, dir] of Object.entries(APPS))
  servers[name] = await serve(dir);

for (let round = 0; round < ROUNDS; round++) {
  // alternate the order between rounds so neither side always runs on a cold or a hot machine
  const order = round % 2 === 0 ? ['react', 'angular'] : ['angular', 'react'];
  for (const app of order) {
    const context = await browser.newContext();
    const page = await openApp(browser, servers[app].url + '/');
    results.meta.ua ??= await page.evaluate(() => navigator.userAgent);
    results.meta.isolated ??= await page.evaluate(() => crossOriginIsolated);
    for (const [scenario, reps] of PLAN) {
      if (ONLY && !ONLY.includes(scenario)) continue;
      for (const size of SIZES) {
        const t0 = Date.now();
        const r = await page.evaluate(
          ([s, n, k]) => window.bench.run(s, n, k),
          [scenario, size, reps],
        );
        results.runs.push({ round, app, scenario, size, ...r });
        console.log(
          `[round ${round}] ${app.padEnd(7)} ${scenario.padEnd(12)} n=${String(r.n).padStart(5)}  ${r.value.toFixed(3)} ${r.unit}${r.tailPerPatch !== undefined ? `  tail/patch ${r.tailPerPatch.toFixed(3)} ms` : ''}${r.first !== undefined ? `  first ${r.first.toFixed(2)} ms` : ''}  (${((Date.now() - t0) / 1000).toFixed(1)}s wall)`,
        );
      }
    }
    if (round === 0) {
      results.memory[app] = {};
      for (const size of SIZES)
        results.memory[app][size] = await memoryProbe(context, page, size);
      console.log(`[memory] ${app}`, JSON.stringify(results.memory[app]));
      results.memoryPlain ??= {};
      results.memoryPlain[app] = {};
      for (const size of SIZES)
        results.memoryPlain[app][size] = await memoryProbe(
          context,
          page,
          size,
          'mountTreeSize',
        );
      console.log(
        `[memory-plain] ${app}`,
        JSON.stringify(results.memoryPlain[app]),
      );
    }
    await page.close();
    await context.close();
  }
}

// aggregate: median across rounds per (app, scenario, size)
const table = {};
for (const r of results.runs) {
  const k = `${r.scenario}|${r.size}`;
  table[k] ??= { scenario: r.scenario, size: r.size, n: r.n };
  (table[k][r.app] ??= []).push(r.value);
  if (r.tailPerPatch !== undefined)
    (table[k][r.app + 'Tail'] ??= []).push(r.tailPerPatch);
  if (r.first !== undefined) (table[k][r.app + 'First'] ??= []).push(r.first);
}
const rows = Object.values(table).map((row) => {
  const o = { scenario: row.scenario, size: row.size, n: row.n };
  for (const key of Object.keys(row))
    if (Array.isArray(row[key])) o[key] = median(row[key]);
  return o;
});
results.summary = rows;
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
writeFileSync(`${OUT}/results-${stamp}.json`, JSON.stringify(results, null, 2));
writeFileSync(`${OUT}/latest.json`, JSON.stringify(results, null, 2));

console.log('\n| scenario | n | React | Angular | ratio (Angular/React) |');
console.log('|---|---|---|---|---|');
for (const r of rows) {
  const ratio = r.angular / r.react;
  console.log(
    `| ${r.scenario} | ${r.n} | ${r.react.toFixed(3)} | ${r.angular.toFixed(3)} | ${ratio.toFixed(2)} |`,
  );
  if (r.reactTail !== undefined)
    console.log(
      `| ${r.scenario} tail/patch | ${r.n} | ${r.reactTail.toFixed(3)} | ${r.angularTail.toFixed(3)} | ${(r.angularTail / r.reactTail).toFixed(2)} |`,
    );
}
for (const [name, s] of Object.entries(servers)) s.server.close();
await browser.close();
