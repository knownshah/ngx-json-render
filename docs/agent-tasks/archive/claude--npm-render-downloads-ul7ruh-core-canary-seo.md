# Core canary and demo SEO

## Metadata

- Branch: `claude/npm-render-downloads-ul7ruh` (third task on this branch; the
  first two are archived as `claude--npm-render-downloads-ul7ruh.md` and
  `claude--npm-render-downloads-ul7ruh-core-0.21-release.md`. Archive this one
  under `...-core-canary-seo.md`)
- Base branch: `main`
- Base commit: `2fe9cf6` (Archive the core 0.21 release task file)
- Current HEAD: `003e1f6` on `main` (`afb690a` the canary, `003e1f6` the demo
  page); this archive commit follows
- Status: **done** — on `main` and deployed on 2026-09-27; this file is the
  archived snapshot
- Last updated: 2026-09-27
- Last agent/tool: Claude Code

## Objective

1. A scheduled workflow that installs the newest `@json-render/core` (and
   `@json-render/directives`) against the current `main`, builds and tests
   both libraries, and opens an issue when the newest core falls outside the
   admitted peer range or the suite fails against it, so the next core minor
   is a GitHub issue before it is an ERESOLVE in a user's project.
2. Make the GitHub Pages demo findable: a descriptive title, meta
   description, canonical URL, Open Graph / Twitter card with a static
   image, and a crawlable intro that is visible before Angular bootstraps.

## User-visible outcome

1. When core 0.22 ships, an issue titled after that version appears within a
   day, with the build/test outcome against it and the procedure from
   AGENTS.md. Once the range admits it and the suite passes, the issue is
   closed by the next run.
2. A search for "json-render angular" can rank the demo; a link to it unfurls
   with title, description and image.

## Context

The download analysis at the start of this branch: the package is absent
from the top results for "json-render angular" while an abandoned competitor
with a landing page is present; the demo page has title "ngx-json-render
demo", no description and no crawlable text. `core-compat` (added with 0.7.2)
proves the floor of the range on every push but says nothing about a core
version newer than the workspace pins.

## Scope

- `.github/workflows/core-canary.yml` (schedule + `workflow_dispatch`).
- AGENTS.md: the workflows row and the core paragraph mention the canary.
- `projects/demo/src/index.html` head tags and the static intro;
  `projects/demo/public/og.png` extracted from `docs/streaming.gif`.

## Non-goals

- Prerendering / SSG for the demo.
- Changing what the demo app renders after bootstrap.

## Acceptance criteria

- Workflow YAML parses; the report step's shell logic is dry-run for the
  four outcomes (admitted+green, admitted+red, not admitted+green, not
  admitted+red); a manual run on `main` is green with core 0.21.0 and opens
  no issue.
- `npx ng build demo` output contains the new head tags; `npx ng test demo
--coverage` passes; `npm run format:check` clean.

## Relevant repository instructions

AGENTS.md matrix: `projects/demo` → `npm run build:lib` and
`npm run build:material`, then `npx ng test demo --coverage` and
`npx ng build demo`; `.github/workflows/**` → read the diff against the
matching npm script, never trigger a release as verification.

## Relevant architecture and contracts

`.github/workflows/ci.yml` (`core-compat` as the template),
`scripts/check-peer-ranges.mjs` (uses the hoisted `semver`).

## Decisions made

- The canary's decision logic lives in `scripts/core-canary-report.sh`, not
  inline in the workflow, so `scripts/lib/core-canary-report.test.mjs` can
  dry-run it with a stubbed `gh` under `npm run test:scripts` (six cases: the
  four outcomes, a duplicate issue, a skipped step after a failure).
- The run is red whenever the canary trips, and one issue per newest core
  version is the durable record; the first green run closes it. No daily
  comments on an open issue.
- Build and test steps use `continue-on-error` with ids so the report can
  name the failed step; steps after a failure are skipped, not reported.
- The Open Graph image is a real screenshot of the demo's Streaming tab
  after the recorded "Weekly report" generation, taken with the container's
  headless Chromium over CDP (`scripts/capture-streaming-gif.mjs`'s approach;
  the bundled ffmpeg cannot decode GIF, and Google Fonts are unreachable
  here, so the Material Symbols in the playground view render as text and
  the streaming tab, which uses the demo's own catalog, was chosen). 1200×630,
  136 kB, at `projects/demo/public/og.png`, copied into the build by the
  existing `public/` asset rule.
- The pre-bootstrap intro sits inside `<app-root>`, where Angular replaces it
  on bootstrap; it repeats the README's first paragraph and the install and
  skill commands.

## Assumptions

- The hoisted `semver` package stays available to `node -e` in CI, as it is
  to `scripts/check-peer-ranges.mjs`.

## Completed

- `.github/workflows/core-canary.yml` (daily 06:17 UTC + `workflow_dispatch`),
  `scripts/core-canary-report.sh`, `scripts/lib/core-canary-report.test.mjs`.
- AGENTS.md: workflows row and a `core-canary` paragraph after `core-compat`.
- `projects/demo/src/index.html`: title, description, canonical, Open Graph
  and Twitter tags, pre-bootstrap intro; `projects/demo/public/og.png`.

## In progress

(nothing)

## Remaining

(nothing)

## Changed files

- `.github/workflows/core-canary.yml` (new)
- `scripts/core-canary-report.sh`, `scripts/lib/core-canary-report.test.mjs` (new)
- `AGENTS.md`
- `projects/demo/src/index.html`, `projects/demo/public/og.png` (new)

## Verification evidence

### Passed

- Workflow YAML parses (js-yaml): `on: schedule, workflow_dispatch`,
  permissions `contents: read`, `issues: write`, steps in the intended order.
- The range expression as the workflow evaluates it, locally: core 0.21.0
  admitted by `>=0.20.0 <0.22.0` → `true`; 0.22.0 → `false`.
- `npm run test:scripts`: the six canary cases plus the existing 13, all
  passing.
- Demo (AGENTS.md matrix for `projects/demo`): `npm run build:lib`,
  `npm run build:material`, `npx ng build demo` (built index.html carries the
  seven new head tags and the intro; `og.png` copied), `npx ng test demo
--coverage` (7 files passed, coverage unchanged at 91.22 / 89.57 / 78.12 /
  93.96).
- `npm run format:check` clean.
- After the merge: CI on `003e1f6` green in all five jobs (run 36311405077,
  `deploy-demo` included); the manual `core-canary` run 36311410478 green in
  every step with core 0.21.0 admitted, no `core-canary` issue opened.
- The deployed page, read by an external fetcher without JavaScript: the new
  title, description, canonical, Open Graph (`og:image` 1200×630) and Twitter
  card tags, and the intro text with the install and skill commands.

### Failed

(none)

### Blocked or not run

- The canary's red path (`gh issue create` against the real repository) is
  proven by the stubbed tests only; it runs for real the day a core version
  outside `<0.22.0` appears.
- `og.png` on the live site: the container's egress proxy denies
  `shteynu.github.io`, and the external fetcher returns `empty_content` for
  a binary rather than a status; the file was in `dist/demo/browser` that
  `deploy-demo` uploaded, and a missing file would have come back as a 404.

### Environment

Cloud container, Node 22, npm 10.9.7, Chromium 141 (Playwright's) for the
screenshot.

### Residual risk

- GitHub disables scheduled workflows in repositories with no activity for
  60 days; a push re-enables them.
- The pre-bootstrap intro is unstyled beyond inline rules; it is visible for
  well under a second on a normal connection.

## Failed approaches

## Known risks

- Scheduled workflows are disabled by GitHub after 60 days without repository
  activity; a push re-enables them.

## Approval gates

None (no publish).

## Questions requiring an owner decision

None.

## Next concrete step

None. The canary runs daily at 06:17 UTC; its first issue will be the next
core minor.
