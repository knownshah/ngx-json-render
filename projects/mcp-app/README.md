# MCP App example (prototype)

The Angular Material catalog served as an [MCP App](https://modelcontextprotocol.io/docs/extensions/apps):
a model calls one tool with a json-render spec, and Claude, ChatGPT, VS Code,
Cursor or any other MCP Apps host renders it inline in the chat as real
Angular Material components.

It is built on upstream's [`@json-render/mcp`](https://www.npmjs.com/package/@json-render/mcp),
not beside it. That package ships the server side (the `render-ui` tool and
the `ui://` resource) and a React hook, `useJsonRenderApp`, for the view in
the iframe. This project adds the missing Angular piece:

| Piece                          | React (upstream)               | Angular (here)                                       |
| ------------------------------ | ------------------------------ | ---------------------------------------------------- |
| MCP server, tool, `ui://` view | `@json-render/mcp`             | the same, see [`server/server.ts`](server/server.ts) |
| View: connect to the host      | `useJsonRenderApp()`           | `injectJsonRenderApp()`, signals                     |
| View: render the spec          | `<Renderer>` + shadcn registry | `<json-render>` + `materialRegistry`                 |
| Render while the model writes  | no, waits for the tool result  | yes, from `toolinputpartial` (`streamPartialInput`)  |
| Host theme                     | not handled                    | follows `theme` from the host context                |

## Run it

```bash
npm run build:lib && npm run build:material   # the view renders the built packages
npm run build:mcp-app                         # dist/mcp-app/view.html + server.mjs

node dist/mcp-app/server.mjs                  # stdio
node dist/mcp-app/server.mjs --http           # Streamable HTTP on http://localhost:3001/mcp
```

Claude Desktop, Cursor (`.cursor/mcp.json`) or VS Code:

```json
{
  "mcpServers": {
    "ngx-json-render": {
      "command": "node",
      "args": ["/absolute/path/to/ngx-json-render/dist/mcp-app/server.mjs"]
    }
  }
}
```

The server resolves its dependencies from this workspace's `node_modules`, so
run it from a checkout, not a copied `dist/`. Then ask for UI: "show me a
dashboard of my last three releases".

## How it fits together

- `src/app/json-render-app.ts`: `injectJsonRenderApp()`. It has the same
  fields as upstream's `UseJsonRenderAppReturn` (`spec`, `loading`,
  `connected`, `connecting`, `error`, `app`, `callServerTool`), as signals,
  and reads a tool result the same way (`parseSpecFromToolResult`).
  Everything specific to this project is an option: `streamPartialInput`,
  `autoResize` and `transport`.
- `src/app/app.ts`: the view, `<json-render>` with the Material registry.
- `scripts/build-mcp-app.mjs`: hosts load a `ui://` resource as one HTML
  document, so the script folds Angular's chunks into one inline module and
  inlines the styles. It then type-checks and bundles the server.
- `server/server.ts`: uses upstream's `registerJsonRenderResource` for the view
  and registers the tool the way `createMcpApp` does, with one fix, below.

The server imports the Material catalog from source
(`projects/ngx-json-render-material/src/lib/catalog.ts`). The published bundle
also contains the components, and loading it in Node would pull in Angular
and its JIT compiler. Upstream splits these two with separate
`@json-render/shadcn/catalog` and `@json-render/react/schema` entry points. A
`ngx-json-render-material/catalog` entry point would do the same here and let
an app's server import the catalog from npm.

## Upstream issue: `createMcpApp` drops `state`, `on` and `watch`

`createMcpApp` in `@json-render/mcp` 0.21.0 passes `catalog.zodSchema()` as
the tool's input schema. That schema describes `root` and `elements` (`type`,
`props`, `children`, `visible`, `repeat`) and nothing else. The MCP SDK parses
tool arguments with it, so a spec's top-level `state` and each element's `on`
and `watch` are stripped before the tool handler runs, and `catalog.validate`
strips them again in the handler. The catalog prompt tells the model to
_always_ send `state` for data-backed UI, so tables and lists arrive empty,
and no button does anything. The React schema has the same shape, so this is
not specific to Angular.

`specInputSchema()` in `server/server.ts` works around it: the spec and element
objects keep unknown keys, `state` is declared so the model sees it in the
tool's JSON Schema, and components and props stay typed, so an unknown
component type is still rejected. Once upstream fixes it, the server can go
back to a plain `createMcpApp({ name, version, catalog, html })`.

## Not done yet

- Actions that should reach the model (for example "Approve", "Show more")
  have no default path. `mcp.app.sendMessage()` and `mcp.callServerTool()` are
  there for an app to wire into `<json-render [handlers]>`.
- `injectJsonRenderApp` lives in this example. If the approach holds, it
  belongs in a `ngx-json-render/mcp` secondary entry point with
  `@modelcontextprotocol/ext-apps` as an optional peer, plus a README section
  and a skill update.
- The view is about 1.4 MB uncompressed, because it bundles Angular Material,
  zod and the MCP SDK. That works for an inline resource, but it has not been
  optimized.
