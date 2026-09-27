# Publish agent skills for both packages

## Metadata

- Branch: `claude/npm-render-downloads-ul7ruh`
- Base branch: `main`
- Base commit: `d0c9d7b` (Release ngx-json-render 0.7.1)
- Current HEAD: the second commit on top of `d0c9d7b` (`7acd1f8` added the
  skills; the next one shortened the renderer skill and updated this file)
- Status: done — committed and pushed; waiting on the owner to open a PR or merge
- Last updated: 2026-09-27
- Last agent/tool: Claude Code

## Objective

Ship public agent skills so `npx skills add shteynu/ngx-json-render` installs
instructions that teach a coding agent (Claude Code, Cursor, Codex, …) how to
use `ngx-json-render` and `ngx-json-render-material`, the way
`vercel-labs/json-render` ships one skill per package.

## User-visible outcome

An Angular developer whose agent has the skill installed gets correct
`ngx-json-render` code generated without pasting the README, and the package
appears on skills.sh. Downloads follow agent-driven installs, which is why the
user asked for this (see the download analysis in the session that opened
this branch: the package is invisible upstream and in search).

## Context

- The upstream skills live in `skills/<name>/SKILL.md` with YAML frontmatter
  (`name`, `description`) and ~160–290 lines of API-focused Markdown; see
  `skills/vue`, `skills/svelte`, `skills/shadcn` in vercel-labs/json-render.
- The skills CLI (`npx skills`, v1.7.0) discovers `skills/<name>/SKILL.md`
  and also `.claude/skills/<name>/SKILL.md`. This repository vendors two
  internal process skills under `.claude/skills` (byte-identical copies, see
  `.claude/skills/SOURCE.md`), so a bare `npx skills add shteynu/ngx-json-render`
  will list those too. Decision below.

## Scope

- `skills/ngx-json-render/SKILL.md` — renderer: install, catalog, components
  (`injectRenderContext`, `<jr-children>`), registry, `<json-render>` inputs,
  spec features, state, streaming (`injectUIStream`, `injectChatUI`, server
  side), `validate` / `renderLimits`, confirm dialog, directives, testing.
- `skills/ngx-json-render-material/SKILL.md` — catalog: install, drop-in
  registry, prompt, component table with props and events, validation,
  overriding a component, extending the vocabulary, theme requirements.
- An "Agent skills" section in the root README and both package READMEs with
  the install command.

## Non-goals

- Changing library code or the vendored `.claude/skills` (byte-identical
  copies; adding `metadata.internal` there would break the re-copy check).
- A skills.sh badge in the README (it would show 0 installs at launch).
- Submitting the skill upstream.

## Acceptance criteria

- `npx skills add ./ --list` from the repository root lists
  `ngx-json-render` and `ngx-json-render-material`.
- Every API name in both skills exists in the packages' public API
  (`projects/*/src/public-api.ts`) or their README.
- `npm run format:check` passes; `git diff --check` is clean.

## Relevant repository instructions

`AGENTS.md`: docs-only change → `git diff --check` and a link check; formatting
via `npm run format:check`. No build needed.

## Decisions made

- Skill names are the package names (`ngx-json-render`,
  `ngx-json-render-material`), not `angular` / `angular-material`: they
  install into a shared per-agent skills directory where a generic name
  collides, and agents look them up by the package they are asked to use.
- Content mirrors the upstream renderer skills' structure so an agent that
  already has the `core` / `react` / `vue` skills sees the same shape.
- The vendored internal skills stay as they are; the documented install
  command names the two public skills with `--skill` so the picker is
  skipped.

## Assumptions

- Facts about the API come from `projects/ngx-json-render/README.md`,
  `projects/ngx-json-render-material/README.md`, the public API files and the
  Material catalog source (`catalog.ts`), all read on this branch at
  `d0c9d7b`.

## Completed

- Research: upstream skill layout, skills CLI discovery rules, public API of
  both packages.
- `skills/ngx-json-render/SKILL.md` (326 lines, cut from a 492-line first
  draft at the owner's request) and `skills/ngx-json-render-material/SKILL.md`
  (231 lines).
- "Agent skills" section in the root README (plus a `skills/` row in the
  workspace layout) and an "Agent skill" section in both package READMEs.

## In progress

(nothing)

## Remaining

- Nothing on this branch. Follow-ups the owner may want: archive this file
  on merge; a skills.sh badge once installs exist.

## Changed files

- `skills/ngx-json-render/SKILL.md` (new)
- `skills/ngx-json-render-material/SKILL.md` (new)
- `README.md`, `projects/ngx-json-render/README.md`,
  `projects/ngx-json-render-material/README.md` (Agent skills section)
- this task file

## Verification evidence

### Passed

- Every TypeScript snippet in both skills compiled inside the demo project:
  the snippets were copied verbatim into two temporary files under
  `projects/demo/src/app/` and `npx ng build demo` succeeded (2026-09-27);
  a deliberate `const x: number = 'x'` in one of them made the same build
  fail, proving the files were type-checked. The files were deleted before
  the commit.
  Repeated for the shortened renderer skill: its snippets were recompiled
  the same way before the second commit.
- `npx skills add ./ --list` (skills CLI 1.7.0) lists `ngx-json-render`,
  `ngx-json-render-material`, `task-tracker`, `verification`.
- `npm run format:check`: all matched files use Prettier code style.
- `git diff --check`: clean.
- Link check: every relative link in the root README and both skills, and
  every `blob/main` link added to the package READMEs, resolves to a file in
  the tree.
- Every API name in the skills was taken from `projects/*/src/public-api.ts`,
  the package READMEs, `projects/ngx-json-render-material/src/lib/catalog.ts`
  and the core type declarations (`@json-render/core@0.20.0`).

### Failed

(none)

### Blocked or not run

- The testing snippet (`ngx-json-render/testing`) was checked against the
  harness interfaces by reading them, not compiled: the demo app build does
  not include the testing entry point.
- No library build or test suite was run for this change: docs only.

### Environment

Cloud container, Node 22, npm 10.9.7, skills CLI 1.7.0 via npx,
`@json-render/core@0.20.0` (lockfile).

### Residual risk

The skill text can drift from the README as the API evolves; nothing checks
one against the other. The root README now says a public API change is not
done until the skill says the same.

## Failed approaches

(none)

## Known risks

- A bare `npx skills add shteynu/ngx-json-render` also offers the two
  internal process skills from `.claude/skills`.

## Approval gates

None.

## Questions requiring an owner decision

None.

## Next concrete step

Open a pull request from `claude/npm-render-downloads-ul7ruh` into `main`, or merge;
then move this file to `docs/agent-tasks/archive/`.
