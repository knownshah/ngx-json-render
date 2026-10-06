# Submit the MCP App to ChatGPT

## Metadata

- Branch: none yet; use `feat/chatgpt-app-submission` if code changes
- Base branch: `main`
- Base commit: n/a; nothing started
- Current HEAD when filed: `3a87f6b`
- Status: **planned, not started**
- Last updated: 2026-10-06
- Last agent/tool: Claude Code (Opus 5.5)

## Objective

Publish `https://ngx-json-render.vercel.app/mcp` (tool `render-ui`) as a
ChatGPT app, the same server already in review in the Claude Connectors
Directory (slug `ngx-json-render-ui`, submitted 2026-10-06).

## Context

- Listing copy for ChatGPT is ready in `docs/mcp-app-directory-listing.md`:
  - the short description;
  - the planned categories (Design, Productivity, Developer tools);
  - eight test cases under "ChatGPT test cases".
  - Its "Before submitting" list still has three items open.
- The docs page (`projects/demo/public/mcp/index.html`) already tells users how
  to connect in ChatGPT: Settings → Apps → Advanced settings → Developer mode.
- The tool was tuned to Claude's limits (`projects/mcp-app/server/tool.ts`):
  - a description under 2,000 characters;
  - the catalog in a 39k-character input schema.
  - ChatGPT's limits on descriptions and schemas are unknown; check them.

## Remaining

1. Test in ChatGPT developer mode with the five positive and three negative
   test cases. Check that the view renders, form validation works, and the
   model fixes a rejected spec.
2. Check `sendMessage` in ChatGPT: does `ui/message` post the message, put it
   in the composer as Claude does, or get declined? The view shows
   "Could not send the message: …" when declined. Then update
   `projects/mcp-app/README.md` ("Not done yet"), the docs page and the
   privacy page, which currently describe only Claude's behaviour.
3. Run MCP Inspector (`npx @modelcontextprotocol/inspector`) against the live
   URL.
4. A verified OpenAI developer account and a verified domain. This is the
   user's step, and the domain question is open: the server is on
   `vercel.app`, the docs on `github.io`.
5. Fill in the submission form from the listing doc. The user submits. Then
   update the doc's status line and "Before submitting" checklist.

## Approval gates

- The account, domain verification and the final Submit are the user's.
- Ask before changing the Claude listing while it is in review.

## Next concrete step

Add the server in ChatGPT developer mode and run test case 1, "Show me a
dashboard of our Q3 sales by region".
