# Compile the skills' snippets in CI, review the day's work, draft the outreach

## Metadata

- Branch: `claude/npm-render-downloads-ul7ruh` (fourth task on this branch;
  archive under `...-skill-check-review-drafts.md`)
- Base branch: `main`
- Base commit: `16b5068`
- Current HEAD: `84e0fcc` (the snippet check) plus the review-fix commit that
  carries this update
- Status: in progress
- Last updated: 2026-09-27
- Last agent/tool: Claude Code

## Objective

1. A check, run by CI and by hand, that every TypeScript snippet in
   `skills/*/SKILL.md` compiles against the built packages, so the README's
   rule ("a public API change is not done until the matching skill says the
   same") is enforced rather than remembered.
2. A review pass over everything merged today (`d0c9d7b..main`), as over a
   stranger's PR.
3. Drafts the owner can post: the upstream reframing (PR #331), a note to
   the maintainers, an article aimed at the query "json-render angular",
   newsletter and community blurbs. Delivered as files, not committed.

## User-visible outcome

`npm run check:skills` fails when a snippet in a skill no longer compiles;
CI runs it. The owner receives ready-to-post texts.

## Scope

- `scripts/check-skill-snippets.mjs`, `check:skills` npm script, a CI step.
- Snippet fixes in both skills where a block was an illustrative fragment
  (marked `ts fragment`) or missing an import / a referenced component.
- AGENTS.md: matrix row and a paragraph; root README: one line.
- Review findings fixed on this branch when they are real.
- Drafts in the session scratchpad, sent to the owner.

## Non-goals

- Compiling `json`, `bash`, `html` blocks or blocks marked `fragment`.
- Changing the skills' structure or length.

## Acceptance criteria

- `npm run check:skills` passes; a deliberate type error in a skill snippet
  makes it fail with the skill file and line named.
- `npm run format:check`, `npm run test:scripts` pass; CI green on `main`.

## Relevant repository instructions

AGENTS.md: builds are the typecheck; `.github/workflows/**` → read the
diff against the matching npm script.

## Decisions made

- One module per `ts` block rather than one module per skill: two snippets
  may both declare `registry` (the Material skill's override and extension
  blocks do), and a reader copies snippets one at a time anyway. Later blocks
  get imports for what earlier blocks declared, decided with the TypeScript
  compiler API (binding names vs. property names vs. references), and
  unexported earlier declarations get an `export { … }` footer.
- `fragment` in the fence info string marks the two excerpts that are not
  modules (the Express route, the testing excerpt with free variables);
  renderers still highlight them as `ts`.
- The two Material snippets that imported a component from `./branded-card`
  and `./sparkline` now define a minimal one inline: self-contained for the
  check and more useful to an agent, which otherwise had to invent the file.
- Modules are generated under `dist/skill-check/` (ignored, cleaned on each
  run) and type-checked by `ngc` with a tsconfig extending the demo's, so the
  `paths` to `dist/` and `strictTemplates` apply and templates are checked.
- Review and drafts follow in this task; the check landed first so the
  review covers it.

## Completed

- `scripts/lib/skill-snippets.mjs` (parse, analyze, stitch, map),
  `scripts/lib/skill-snippets.test.mjs` (six cases),
  `scripts/check-skill-snippets.mjs` (runner), `check:skills` npm script, CI
  step after the Material build, AGENTS.md row and paragraph, README line,
  snippet fixes in both skills.

## In progress

Review fixes (this commit).

## Remaining

- Review findings, if any, fixed.
- Drafts (upstream, maintainers, article, newsletters, community) in the
  scratchpad, sent to the owner.
- Archive this file.

## Changed files

- Commit `84e0fcc`: `scripts/check-skill-snippets.mjs`,
  `scripts/lib/skill-snippets.mjs`, `scripts/lib/skill-snippets.test.mjs`,
  `package.json`, `.github/workflows/ci.yml`, `AGENTS.md`, `README.md`, both skills.
- Review fixes: `.github/workflows/core-canary.yml`,
  `scripts/core-canary-range.mjs` (new) with
  `scripts/lib/core-canary-range.test.mjs`, `scripts/core-canary-report.sh`,
  `scripts/lib/core-canary-report.test.mjs`, `.github/workflows/release.yml`,
  `.github/workflows/release-material.yml`, `.github/workflows/ci.yml` (a
  comment), the stitcher, the runner and their tests, the two archived task
  files.

## Verification evidence

### Passed

- `node --test scripts/lib/skill-snippets.test.mjs`: 6 pass;
  `npm run test:scripts`: 25 pass, 0 fail.
- `npm run check:skills` against the built packages: renderer 4 of 6 `ts`
  blocks compiled (2 fragments), Material 4 of 4; "All 8 snippet modules
  compile."
- Failure path: `readonly registry: number = materialRegistry;` planted in
  the Material skill is reported as
  `skills/ngx-json-render-material/SKILL.md:41:12 - error TS2322 …` (the
  right line), exit 1; the skill was restored.
- `npm run format:check` clean.

### Failed

(none)

### Blocked or not run

- CI on `main` with the new step: pending the push.

### Environment

Cloud container, Node 22, npm 10.9.7, TypeScript 5.9.3, ngc from
@angular/compiler-cli 21.2.

### Residual risk

- The stitcher resolves references by name only: a snippet that shadows an
  earlier top-level name inside a function body is still linked to the
  earlier declaration if it also uses the name outside. Not the case today.

## Approval gates

None.

## Next concrete step

Drafts for the owner (upstream comment, maintainers' note, article,
newsletter and community blurbs) in the scratchpad; then archive this file.
