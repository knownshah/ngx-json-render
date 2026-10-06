# MCP App: buttons that send a message back to the model

## Metadata

- Branch: none; committed straight to `main`
- Base branch: `main`
- Base commit: `ae5c5a5`
- Current HEAD: `3a87f6b` on `main`, pushed to `origin/main`
- Status: done, verified in Claude, deployed (Vercel server, GitHub Pages docs)
- Last updated: 2026-10-06
- Last agent/tool: Claude Code (Opus 5.5)

## Objective

Let a button in the `projects/mcp-app` view hand the user's choice (an
approval, a filled-in form) back to the model, so the conversation carries on
from what was clicked instead of the UI being a dead end.

## Completed

- `65acde9`: the `sendMessage` catalog action (`text` plus optional `data`),
  sent to the host as `ui/message`; a form is sent only once it validates.
- `fe6263e`: the docs and privacy pages describe the action.
- `5d3346f`: `server/tool.ts`. Claude cuts tool descriptions at about 2,000
  characters, and the old 25,899-character `catalog.prompt()` lost every
  component and action. Now there is a 1,630-character description plus a
  typed 39k-character input schema: per-component props and per-action
  params, dynamic values, and shared `$defs`. `specProblems` covers what the
  schema cannot express, such as missing children.
- `cedd02e`: a visible notice in the view: "Message passed to the chat." or
  "Could not send the message: …".
- `77dc714`, `3a87f6b`: the Claude directory listing's Permissions summary and
  Description mention the message-box button. The live listing was saved and
  `docs/mcp-app-directory-listing.md` was synced.

## Verification evidence

### Passed

- `projects/mcp-app`: 31 tests, coverage 99% overall and 100% lines in
  `app.ts`. The server `tsc` and `build:mcp-app` pass.
- claude.ai, after Refresh tools list: the model sees the whole schema and
  writes a valid spec on the first try. With a real mouse, Approve shows the
  notice and puts the text in the message box under Claude's "Use caution"
  banner; the user sends it.

### Blocked or not run

- ChatGPT: not tried. See `docs/agent-tasks/active/feat--chatgpt-app-submission.md`.

## Failed approaches

- Clicking the MCP App iframe through the Claude in Chrome extension: the
  clicks land on the iframe but never reach inside it. Ask the user to click.

## Next concrete step

None; the work is finished. The follow-up is the ChatGPT submission task.
