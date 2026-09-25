# Benchmark: ngx-json-render vs @json-render/react

Two tiny apps, one per renderer, driven through identical scenarios by one Playwright script in one headless Chromium, plus the same trees rendered by hand-written components in each framework. This is the harness behind the article _Same Spec, Two Renderers_ and its second part.

Not part of the library's build or tests: nothing under `bench/` is published to npm or run in CI.

## Layout

- `shared/spec-gen.js` builds byte-identical specs for both apps (flat lists, a deep 3-ary tree, a `repeat` list), the immutable edits the scenarios apply, and the nested trees for the hand-written baselines.
- `shared/scenarios.js` holds the scenarios. Renderer scenarios: `mount`, `mountDeep`, `patchLeaf`, `patchLeafDeep`, `sameSpec`, `stateOne`, `stateAll`, `repeatAppend`, `unmount`, `stream`, `streamChunked`. Framework-only baselines: `plainMount`, `plainMountDeep`, `plainPatchLeaf`, `plainSameTree`, `plainUnmount`. Each times one synchronous update and checks the DOM afterwards.
- `react-bench/` is a Vite app on `@json-render/react` and React 19; the adapter is `src/main.jsx`, the catalog `src/catalog.jsx`, the hand-written tree `src/plain.jsx`.
- `angular-bench/` is an Angular CLI app on ngx-json-render (zoneless); the adapter is `src/app.ts`, the catalog `src/catalog.ts`, the hand-written tree `src/plain.ts`. Its `tsconfig.json` maps `ngx-json-render` to the repository's `dist/`, and it resolves Angular from the repository's `node_modules`.
- `driver/run.mjs` serves both builds with COOP/COEP headers (5 µs `performance.now()`), runs the matrix with the app order alternating between rounds, probes heap use over CDP, and prints a Markdown table of medians. `driver/boot.mjs` measures time to a ready renderer and the first cold mount.
- `results/<date>/` keeps the raw numbers behind the article: `full.json`, `chunked.json`, `plain.json`, `boot.json`. Fresh runs write to `results/` and are ignored by git.

## Run

From the repository root, build the library first so the Angular app compiles against `dist/`:

```bash
npm ci && npm run build:lib
cd bench
npm install            # playwright-core for the driver
npm run install:react  # React 19, @json-render/react 0.20.0, Vite 8
npm run build          # both apps, production
npm run bench -- --sizes=100,1000,4000 --rounds=2
npm run bench:boot
```

`run.mjs` takes `--sizes`, `--rounds`, `--only=<scenario,...>` and `--out=<dir>`. Both apps expose the same `window.bench` adapter, so a third renderer only needs a fourth adapter of the same shape.

The driver expects Playwright's Chromium to be installed for `playwright-core` 1.56 (`npx playwright install chromium` with the matching `playwright` version, or `PLAYWRIGHT_BROWSERS_PATH` pointing at an existing install).
