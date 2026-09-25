// Time from navigation start to the renderer being ready (script download over
// localhost + parse/compile + framework bootstrap), and the cost of the very
// first mount of a 1,000-element spec in a fresh page (cold JIT).
import { chromium } from 'playwright-core';
import { serve } from './serve.mjs';
const APPS = {
  react: new URL('../react-bench/dist/', import.meta.url).pathname,
  angular: new URL('../angular-bench/dist/browser/', import.meta.url).pathname,
};
const N = Number(process.argv[2] ?? 7);
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const browser = await chromium.launch();
const out = {};
for (const [app, dir] of Object.entries(APPS)) {
  const { server, url } = await serve(dir);
  const ready = [],
    first = [],
    scriptBytes = [];
  for (let i = 0; i < N; i++) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url + '/');
    await page.waitForFunction(() => window.benchReady === true);
    const t = await page.evaluate(() => ({
      ready: performance.now(),
      res: performance
        .getEntriesByType('resource')
        .filter((r) => r.name.endsWith('.js'))
        .reduce((a, r) => a + r.transferSize, 0),
    }));
    ready.push(t.ready);
    scriptBytes.push(t.res);
    first.push(
      await page.evaluate(() => {
        const t0 = performance.now();
        window.bench.mountSize(1000);
        return performance.now() - t0;
      }),
    );
    await context.close();
  }
  out[app] = {
    readyMs: median(ready),
    firstMount1000Ms: median(first),
    readyAll: ready.map((x) => +x.toFixed(1)),
    firstAll: first.map((x) => +x.toFixed(1)),
  };
  console.log(app, JSON.stringify(out[app]));
  server.close();
}
await browser.close();
import { writeFileSync } from 'node:fs';
writeFileSync(
  new URL('../results/boot.json', import.meta.url).pathname,
  JSON.stringify(out, null, 2),
);
