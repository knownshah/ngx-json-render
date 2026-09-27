# Admit @json-render/core 0.21 and release 0.7.2 / 0.3.5

## Metadata

- Branch: `claude/npm-render-downloads-ul7ruh` (second task on this branch; the
  first, the agent skills, is archived as
  `docs/agent-tasks/archive/claude--npm-render-downloads-ul7ruh.md`. Archive
  this one under a distinct name, e.g. `...-core-0.21-release.md`)
- Base branch: `main`
- Base commit: `d892709` (Hide the vendored process skills from the skills CLI)
- Current HEAD: `9e51d4c` on `main`; released as `v0.7.2` and
  `material-v0.3.5`, both tags on that commit
- Status: **done** — published to npm on 2026-09-27; this file is the
  archived snapshot
- Last updated: 2026-09-27
- Last agent/tool: Claude Code

## Objective

Make both packages installable next to `@json-render/core` 0.21 (released
2026-09-18), prove the supported core range in CI instead of promising it,
and prepare the releases `ngx-json-render@0.7.2` and
`ngx-json-render-material@0.3.5` that carry the fix and the new README
sections. Tags are pushed only on the owner's explicit go-ahead.

## User-visible outcome

`npm install ngx-json-render` no longer ERESOLVEs in a project on core 0.21
and no longer downgrades core on a fresh install; `standardDirectives` from
`@json-render/directives@0.21` type-checks against the `directives` input;
npmjs.com shows the "Agent skill" section for both packages.

## Context

Measured on this branch before the change (see the download analysis earlier
in the session): with the peer `^0.20.0`, a fresh `npm install ngx-json-render
@json-render/core zod` resolves core down to 0.20.0, and a project that already
has core 0.21.0 gets ERESOLVE. Against core 0.21.0 the library builds and the
Material catalog passes 68/68; the renderer suite fails to compile only in
`directives.spec.ts:69`, where `standardDirectives` (now typed precisely by
`@json-render/directives@0.21.0`) is not assignable to
`DirectiveDefinition[]`; `DirectiveDefinition` itself did not change between
0.20.0 and 0.21.0.

## Scope

- Widen the `directives` input type (and the matching spec/testing types).
- Peer `@json-render/core`: `>=0.20.0 <0.22.0` in both package manifests.
- Move the workspace to core/directives 0.21 (lockfile) so the main CI job
  proves the newest core; add a `core-compat` CI job that installs the floor
  (0.20) the way `angular-compat` does for Angular.
- README / AGENTS.md: state the tested core range and the new job.
- Version bumps 0.7.1 → 0.7.2 and 0.3.4 → 0.3.5 in a release commit.

## Non-goals

- Any behaviour change in the renderer or the catalog.
- Pushing release tags without the owner's explicit instruction.
- Supporting core < 0.20.

## Acceptance criteria

- `npm ci`, `npm run build`, `npm test`, `npm run check:peers`,
  `npm run check:zoneless`, `npm run test:scripts`, `npm run format:check`
  pass on the workspace at core 0.21.
- The `core-compat` steps (install core/directives 0.20, build lib, test lib,
  build material) pass locally and in CI.
- A lockfile-only install probe shows: fresh install resolves core 0.21.x;
  a project on core 0.21.0 installs `ngx-json-render` without ERESOLVE.
- CI green on `main` before any tag.

## Relevant repository instructions

`AGENTS.md`: builds are the typecheck; `package.json`/lockfile change →
`npm ci` then full `npm run build` and `npm test`; `.github/workflows/**` →
read the diff against the matching npm script, never trigger a release as
verification; renderer first, catalog after; tags drive publishing.

## Relevant architecture and contracts

`projects/ngx-json-render/src/lib/renderer.component.ts` (`directives`
input), `projects/ngx-json-render/src/lib/directives.spec.ts`,
`.github/workflows/ci.yml` (`angular-compat` as the template),
`scripts/check-peer-ranges.mjs` (sibling ranges only; core is external).

## Decisions made

- The `directives` input (and the matching spec/testing option types) is
  `DirectiveDefinition<any>[]`, not `DirectiveDefinition[]`. `standardDirectives`
  and anything `defineDirective()` returns are typed with their own schema,
  and `resolve` is a function-typed property, so the base type only accepts
  them by variance shortcut. Plain `tsc -p tsconfig.spec.json` still accepts
  them on core 0.21; the Angular unit-test build does not (same TypeScript
  5.9.3, root cause in the builder's program not identified). Either way the
  input is meant to take a directive of any schema, which the widened type
  says outright. `createDirectiveRegistry` accepts the widened array.
- The workspace pins the newest admitted core (0.21) so the main CI job and
  its coverage thresholds run there; the new `core-compat` job reinstalls the
  floor (0.20) with `npm install --no-save`, mirroring `angular-compat`. A
  matrix, so the next floor bump is one line.
- Peer range `>=0.20.0 <0.22.0` in both manifests; the workspace's own
  dependency is `^0.21.0`.
- Docs keep saying `DirectiveDefinition[]` for the input; the generic is an
  implementation detail.
- Tags cannot be pushed from this container (the session's git proxy
  answers `HTTP 403` to `refs/tags/*` pushes; branch pushes work), so both
  release workflows gained `workflow_dispatch`: a separate `tag` job with
  `contents: write` (and no npm credentials) derives the tag from the
  manifest, creates it with the workflow token (which starts no second run),
  refuses a tag that already exists on another commit, and hands the name to
  the publish and release jobs. A tag push goes through the same graph. The
  step logic was dry-run locally with a stubbed `gh` for both events and the
  three tag states.

## Assumptions

- Patch releases suffice: the changes only widen what is accepted, and the
  catalog's peer `ngx-json-render: ^0.7.0` admits 0.7.2.

## Completed

- Research: upstream React/Vue 0.21 still type the prop `DirectiveDefinition[]`;
  `standardDirectives` is typed identically in directives 0.20.0 and 0.21.0;
  `DirectiveDefinition` and `PropResolutionContext` unchanged in core.
- Workspace moved to core/directives `^0.21.0` (lockfile updated).
- `directives` input widened; renderer suite on 0.21: 12 files, 332 tests,
  coverage 95.7 / 90.18 / 95.35 / 97.22 (thresholds 94 / 88 / 92 / 96).
- Peer ranges widened in both manifests; `check:peers` coherent.
- `core-compat` job added to `ci.yml`; AGENTS.md matrix row and paragraph;
  README of both packages and the renderer skill state the admitted range.

## In progress

(nothing)

## Remaining

(nothing)

## Changed files

- `projects/ngx-json-render/src/lib/renderer.component.ts` (input type)
- `projects/ngx-json-render/src/lib/directives.spec.ts`,
  `projects/ngx-json-render/src/lib/render-precision.spec.ts`,
  `projects/ngx-json-render/testing/src/render-spec.ts` (matching types)
- `projects/ngx-json-render/package.json`,
  `projects/ngx-json-render-material/package.json` (peer range)
- `package.json`, `package-lock.json` (workspace on core/directives 0.21)
- `.github/workflows/ci.yml` (`core-compat` job)
- `AGENTS.md`, `projects/ngx-json-render/README.md`,
  `projects/ngx-json-render-material/README.md`, `skills/ngx-json-render/SKILL.md`

## Verification evidence

### Passed

All on 2026-09-27, in this container, log in the session scratchpad
(`verify-release.log`, one file per step under `verify-steps/`):

- `core-compat` steps at the floor: `npm install --no-save @json-render/core@0.20
@json-render/directives@0.20` (resolved 0.20.0 / 0.20.0), `npm run build:lib`,
  `npx ng test ngx-json-render` (12 files passed), `npm run build:material`,
  `npm run test:material` (68/68, coverage 98.9% statements, 96.78% branches).
- `npm ci` back to the lockfile (core 0.21.0, directives 0.21.0).
- `npm run build` (both libraries and the demo), `npm test`: renderer 12 files /
  332 tests, coverage 95.7 / 90.18 / 95.35 / 97.22 against thresholds
  94 / 88 / 92 / 96; demo 7 files, coverage 91.22 / 89.57 / 78.12 / 93.96;
  Material 68/68.
- `npm run check:zoneless`: 3 manifests free of zone.js, 74 sources free of
  NgZone, 17 suites explicitly zoneless, 3 bundles clean.
- `npm run test:scripts`: 13 pass, 0 fail. `npm run check:peers`: coherent.
  `npm run format:check`: clean.
- Install probes with the packages packed from `dist/` (which carry the new
  peer range `>=0.20.0 <0.22.0`), lockfile-only installs in empty projects:
  fresh `install <renderer.tgz> @json-render/core zod` resolves core 0.21.0
  (0.7.1 from npm resolves it down to 0.20.0); a project already on core
  0.21.0 installs the renderer without ERESOLVE; one on 0.20.0 keeps 0.20.0;
  the Material pair with `@angular/material` resolves core 0.21.0.

### Failed

(none)

### Blocked or not run

- `angular-compat` (Angular 20 and 22) not run locally; CI runs it on `main`
  before any tag is pushed, and this change does not touch what
  `scripts/angular-compat.mjs` rewrites.
- `check:published` needs the publish: the release workflows run it.

### Environment

Cloud container, Node 22, npm 10.9.7, TypeScript 5.9.3, `@json-render/core`
0.21.0 pinned (0.20.0 for the compat steps).

### Residual risk

- Root cause of the Angular-build-only type error is not identified (plain
  `tsc -p projects/ngx-json-render/tsconfig.spec.json` accepts what the
  builder rejected). The widened input type removes the failure mode
  regardless of which program does the checking.
- `<0.22.0` needs the same treatment when core 0.22 ships; `core-compat` is
  where that shows first.

## Failed approaches

## Known risks

- Upstream ships a core minor every two to three weeks; `<0.22.0` will need
  the same treatment again. The `core-compat` job makes that visible.

## Approval gates

- Pushing `v0.7.2` and `material-v0.3.5` publishes to npm: owner's explicit
  instruction required.

## Questions requiring an owner decision

None.

## Next concrete step

None. Published: `ngx-json-render@0.7.2` (Release run 36310058084) and
`ngx-json-render-material@0.3.5` (run 36310206526), both by `workflow_dispatch`
on `main` at `9e51d4c`; the `tag` job created `v0.7.2` and `material-v0.3.5`,
`check:published` passed in both runs, GitHub releases exist for both. From
the registry afterwards: a fresh `npm install ngx-json-render @json-render/core
zod` resolves 0.7.2 with core 0.21.0; a project on core 0.21.0 installs 0.7.2
without ERESOLVE; the catalog README's install line resolves 0.3.5 + 0.7.2 +
core 0.21.0 + Angular 22.2.0; both npm READMEs carry the "Agent skill" section.
