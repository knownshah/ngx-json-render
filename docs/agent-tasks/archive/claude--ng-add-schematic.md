# `ng add` for both packages, and a Hashbrown comparison

## Metadata

- Branch: `claude/ng-add-schematic`
- Base branch: `main`
- Base commit: `beeb144`
- Status: **done** — merged into `main` on 2026-09-30 at the owner's explicit
  request; released as `ngx-json-render` 0.7.3 and
  `ngx-json-render-material` 0.3.6 through the workflows' `workflow_dispatch`
  (this environment's git proxy refuses tag pushes; each run created its tag)
- Last agent/tool: Claude Code

## Objective

Lower the cost of trying the packages: `ng add ngx-json-render` and
`ng add ngx-json-render-material` install everything a first render needs,
and the renderer's README answers "why not Hashbrown?".

## Decisions made

- The schematics read peer ranges from the package's own manifest at run
  time, so a peer bump needs no schematic change.
- The catalog's schematic adds `@angular/material` at the workspace's
  `@angular/core` range and runs Material's own `ng-add` after the install;
  a workspace that has Material keeps its setup.
- `.cts` → `.cjs`, not a nested `{ "type": "commonjs" }` package.json:
  `npm pack` leaves nested package.json files out (seen in the tarball).
- `@angular/cdk` and `@angular/material` became optional peers of the
  catalog. With required `>=20.0.0` peers, npm auto-installed cdk 22.2.1 on
  an Angular 21 app and `ng add` ERESOLVEd before the schematic ran (seen,
  then seen fixed, in the end-to-end run below).
- The budget: the Material example builds to 1.30 MB initial (Material
  435 kB, zod 304 kB, both packages ≈72 kB), over `ng new`'s 1 MB error
  budget. The schematic and README say so; `angular.json` is not edited.

## Verification evidence

### Passed

- `npm run build`, `npm test` (renderer 332, demo 58, catalog 68, schematics
  8), `check:skills` (8 modules), `check:peers`, `check:zoneless`,
  `test:scripts` (29), `format:check`, `git diff --check`.
- `test:schematics` fails on a planted bug in each built schematic (a peer
  dropped; Material's ng-add not scheduled).
- End to end with npm 11.21 (npm 10.9.7 crashes on `ng new`'s install with
  `edgesOut` of null, unrelated): `ng new` on Angular CLI 21, `ng add` of the
  packed renderer, then of the packed catalog — Material ^21.2.0, cdk, theme
  in `styles.scss`, Roboto and Material Icons in `index.html` — and the
  README's Material example builds once the budget is raised.

- After release: `ng new` (Angular 21) plus `ng add ngx-json-render-material`
  from the public registry added the renderer, core, zod and Material 21,
  and set up the theme and icon font; both release runs green, npm `latest`
  is 0.7.3 / 0.3.6 with the schematics and the optional Material peers.
- Good-first issues #1–#3 opened.

### Blocked or not run

- `angular-compat` (20/22) not re-run: no library source changed.

## Next concrete step

None on the code. Owner: enable GitHub Discussions (Settings → General →
Features); post the outreach drafts, now with `ng add` as the first step.
