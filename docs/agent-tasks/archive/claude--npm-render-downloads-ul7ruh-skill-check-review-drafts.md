# Compile the skills' snippets in CI, review the day's work, draft the outreach

## Metadata

- Branch: `claude/npm-render-downloads-ul7ruh` (fourth task on this branch;
  archive under `...-skill-check-review-drafts.md`)
- Base branch: `main`
- Base commit: `16b5068`
- Current HEAD: `a0c3ccb` on `main` (`84e0fcc` the check, `3ef5c8a` the review
  fixes, `a0c3ccb` the fixture fix); this archive commit follows
- Status: **done** on 2026-09-27; this file is the archived snapshot
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
  `scripts/lib/skill-snippets.test.mjs` (seven cases),
  `scripts/check-skill-snippets.mjs` (runner), `check:skills` npm script, CI
  step after the Material build, AGENTS.md row and paragraph, README line,
  snippet fixes in both skills (`84e0fcc`).
- Review of `d0c9d7b..84e0fcc` with the code-review skill: ten findings, all
  fixed in `3ef5c8a` (canary range across every manifest via
  `scripts/core-canary-range.mjs` + test, guarded Report step and script,
  annotated-tag dereference in both release workflows, unterminated fence
  is an error, ngc through node, dead code, temp dirs, comment, EOF blank
  lines, task metadata). `3ef5c8a` shipped with a wrong test fixture that
  `a0c3ccb` corrected; CI on `3ef5c8a` is the one red run on `main` today.
- Drafts sent to the owner as files: PR #331 comment ("Community renderers"
  section), maintainers' note (DM and forum versions), a dev.to article
  built from the compiled snippets, newsletter / Discord / Angular Space /
  social texts.

## In progress

(nothing)

## Remaining

(nothing)

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

- `npm run test:scripts`: 29 pass (stitcher 7, canary report 6, canary range
  3, release verdicts 13).
- `npm run check:skills`: "All 8 snippet modules compile"; a planted type
  error is reported as `skills/ngx-json-render-material/SKILL.md:41:12`.
- Tag-step dry run with a stubbed `gh`: missing / same commit / other commit
  / annotated tag on the same commit behave as intended.
- `npm run format:check` clean; `git diff --check` clean, including the two
  archived task files.
- CI on `main`: `84e0fcc` green (the new "Compile the skills' snippets" step
  included), `a0c3ccb` green in all five jobs.
- `core-canary` dispatched on `a0c3ccb` (run 36313559868): range step with
  both manifests, build, tests and Report all green, no issue opened.

### Failed

- CI on `3ef5c8a`: `test:scripts` failed on the unterminated-fence fixture
  that closed its block after all; fixed in `a0c3ccb` (see Completed).

### Blocked or not run

- The canary's red path and the release workflows' annotated-tag path run
  for real only when those situations occur; both are covered by dry runs.

### Environment

Cloud container, Node 22, npm 10.9.7, TypeScript 5.9.3, ngc from
@angular/compiler-cli 21.2.

### Residual risk

- The stitcher links references by name only: a snippet that shadows an
  earlier top-level name inside a function body is still linked to the
  earlier declaration if it also uses the name outside. Not the case today.

## Approval gates

None.

## Next concrete step

None. Posting the drafts is the owner's.
