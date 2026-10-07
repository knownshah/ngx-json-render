# Submit the MCP App to ChatGPT

## Metadata

- Branch: `main` (this repo commits straight to main); changes uncommitted
- Base commit: `3e158b8`
- Status: **package ready locally; waiting on the user's OpenAI steps**
- Last updated: 2026-10-07
- Last agent/tool: Claude Code (Opus 5.5)

## Objective

Publish `https://ngx-json-render.vercel.app/mcp` (tool `render-ui`) in the
ChatGPT plugin directory, the same server already in review in the Claude
Connectors Directory (slug `ngx-json-render-ui`, submitted 2026-10-06).

## What OpenAI requires now (docs read 2026-10-07)

OpenAI renamed apps to **plugins**; ChatGPT and Codex share one directory.
Sources: developers.openai.com/plugins/deploy/submission,
/plugins/deploy/submission-errors, /plugins/plugin-guidelines,
/plugins/reference.

- Submission is a **ZIP package** uploaded at platform.openai.com/plugins:
  root `plugin.json` (with `extensions.com.openai.interface`) plus
  `mcp.json`; the portal then connects to and scans the MCP server.
- **Developer identity verification** (individual or business) on
  platform.openai.com; the directory shows that name. User's step.
- **Domain verification**: the token as plain text at
  `https://<MCP host>/.well-known/openai-apps-challenge`, root only. Whether
  `*.vercel.app` passes is unverified; a custom domain is the safe choice.
  The MCP origin cannot change between versions.
- Required URLs: website, support, privacy policy, **terms of service**
  (we have no terms page yet). Privacy must list data categories, purposes,
  recipients, retention and user controls.
- `_meta.ui.domain` is required for a plugin with UI and must be unique.
  We do not set it.
- All three annotations `readOnlyHint`, `destructiveHint`, `openWorldHint`
  explicit on every tool: already true (`server/app.ts`).
- Exactly 5 positive and 3 negative test cases, a **demo video URL**,
  release notes, countries. Screenshots optional, 706 px wide exactly.
- Limits: name ≤ 30, subtitle ≤ 30, description ≤ 4000, ≤ 3 starter
  prompts ≤ 128 each. No "MCP"/"Plugin" in the name.
- Categories: no Design. Planned: Developer Tools + Productivity.

## Test results, 2026-10-07

ChatGPT web, Free plan, user's account. Developer mode and "Enforce CSP in
developer mode" switched on by the user (Settings → Security and login).
Plugin added via chatgpt.com/plugins → + → Add custom MCP server → Create
MCP App: name "ngx-json-render UI", No Auth. The tool shows as READ with an
"Output schema recommended" note.

| Case                                      | Result                                           |
| ----------------------------------------- | ------------------------------------------------ |
| 1 dashboard (with and without CSP)        | pass: tiles, regional table, callout             |
| 2 sign-up form                            | pass: email and password-length messages on blur |
| 3 release status                          | pass: progress bar, callout, checklist           |
| 4 hosting plans                           | pass: three cards                                |
| 5 Alice/Bob/Chen table                    | pass                                             |
| Negatives 1–3, no @ mention               | pass: plain text                                 |
| sendMessage (Approve on an approval card) | posts; see below                                 |

Findings:

- Prompts must select the plugin with `@ngx-json-render UI`. Without it,
  ChatGPT answered a data-bearing dashboard prompt with its own native chart,
  and refused to invent data for a data-less one. With the mention it calls
  the tool even for "Write a haiku" — so negatives run without the mention,
  positives with it, and the test-case text should say so.
- **sendMessage**: a real mouse click posts the text straight into the
  chat (not the composer), the view shows "Message passed to the chat.",
  but ChatGPT did not answer it within 25 s. No `data` JSON was attached
  because the model passed `{"$state":"/release"}`, a string, and the view
  attaches only objects — not a ChatGPT issue. Agent (extension) clicks on Approve did nothing and
  showed no notice, while agent typing into form fields worked.
- Text drops line breaks: a haiku rendered on one line.
- A table card once kept ~50 px of empty space at its bottom.

## Done this session (uncommitted)

- Domain decision: stay on `ngx-json-render.vercel.app` (user, 2026-10-07).
- `server/app.ts`: the view resource carries
  `_meta["openai/widgetDomain"] = VIEW_DOMAIN` (`https://ngx-json-render.vercel.app`).
  Not `_meta.ui.domain`: its format is per host, and Claude expects
  `{hash}.claudemcpcontent.com` there.
- `scripts/build-mcp-app.mjs --vercel`: if
  `projects/mcp-app/server/openai-apps-challenge.txt` exists, serves it at
  `/.well-known/openai-apps-challenge` as `text/plain`. Checked with a dummy
  token: route and file land in `.vercel/output`, no trailing newline.
- `projects/demo/public/mcp/terms.html` (new); `privacy.html` gains "Your
  choices" and ChatGPT's sendMessage behaviour, effective 7 October; links
  from the docs page, privacy page and landing page. ChatGPT connect steps
  on the docs page rewritten for the Plugins UI.
- `projects/mcp-app/chatgpt-plugin/plugin.json` + `mcp.json`;
  `npm run pack:chatgpt-plugin` checks OpenAI's limits and writes
  `dist/chatgpt-plugin.zip` (icon from `projects/demo/public/mcp/icon-512.png`).
  Category Productivity; `countries: []`; no demo URL yet.
- README "Not done yet" and `docs/mcp-app-directory-listing.md` updated.

Checks run: `npx ng test mcp-app` 31/31; `npm run build:mcp-app -- --vercel`;
stdio `resources/read` shows `openai/widgetDomain`; `npx ng build demo`;
`npm run pack:chatgpt-plugin`; prettier on changed files.

## Remaining

1. User: commit and push (deploys Vercel and GitHub Pages; terms.html must be
   live before submitting).
2. User: developer identity verification at platform.openai.com.
3. Upload `dist/chatgpt-plugin.zip`, get the challenge token, commit it as
   `projects/mcp-app/server/openai-apps-challenge.txt`, deploy, Verify Domain.
4. User: demo video URL; Submit, then Publish after approval.
5. Optional: `outputSchema` on render-ui; Text line breaks; MCP Inspector run.

## Approval gates

- Account verification, domain verification, the demo video, Submit and
  Publish are the user's.
- Security settings in the user's ChatGPT account are switched by the user.
- Ask before changing the Claude listing while it is in review.

## Next concrete step

The user commits and pushes this work, then uploads `dist/chatgpt-plugin.zip`
at platform.openai.com/plugins to obtain the domain challenge token.
