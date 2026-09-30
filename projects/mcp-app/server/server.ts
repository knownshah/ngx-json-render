// MCP server for the Material catalog, on upstream's @json-render/mcp: the
// `ui://render-ui/view.html` resource is its `registerJsonRenderResource`,
// serving the Angular view built next to this file, and the `render-ui` tool
// is registered the way its `createMcpApp` does it — same name, same
// catalog-generated description — with one fix, see `specInputSchema`.
// Nothing here is Angular-specific; the only Angular part is the view.
//
//   npm run build:mcp-app
//   node dist/mcp-app/server.mjs            # stdio, for Claude Desktop / Cursor / VS Code
//   node dist/mcp-app/server.mjs --http     # Streamable HTTP on :3001/mcp
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Catalog } from '@json-render/core';
import { registerJsonRenderResource } from '@json-render/mcp';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
// The catalog alone — the build bundles it from source so the server does not
// load the Angular components (and Angular) along with it. See README.md.
import { materialCatalog } from '../../ngx-json-render-material/src/lib/catalog';

const TOOL_NAME = 'render-ui';
const RESOURCE_URI = `ui://${TOOL_NAME}/view.html`;

/**
 * The tool's input schema: the catalog's spec schema, loosened.
 *
 * `createMcpApp` passes `catalog.zodSchema()` as it is. That schema describes
 * `root` and `elements` (type, props, children, visible, repeat) and nothing
 * else, and the MCP SDK parses tool arguments with it — which strips the
 * spec's top-level `state` and each element's `on` and `watch` before the
 * handler runs. The catalog prompt tells the model to always send `state`, so
 * every data-backed UI arrived empty and no button did anything. Here the spec
 * and element objects keep unknown keys, `state` is declared so the model sees
 * it in the tool's JSON Schema, and components and props stay typed.
 */
export function specInputSchema(catalog: Catalog) {
  const spec = catalog.zodSchema() as z.ZodObject<{
    root: z.ZodType;
    elements: z.ZodRecord<z.ZodString, z.ZodObject>;
  }>;
  const element = spec.shape.elements.valueType;
  return z.looseObject({
    ...spec.shape,
    elements: z.record(z.string(), z.looseObject(element.shape)),
    state: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        'Initial state model; bindings read it with {"$state": "/path"}.',
      ),
  });
}

const html = readFileSync(new URL('./view.html', import.meta.url), 'utf8');

export async function createServerInstance(catalog: Catalog = materialCatalog) {
  const server = new McpServer({
    name: 'ngx-json-render Material',
    version: '0.0.0',
  });
  registerAppTool(
    server,
    TOOL_NAME,
    {
      title: 'Render UI',
      description:
        'Render an interactive UI. The spec argument must be a json-render spec conforming to the catalog.\n\n' +
        catalog.prompt(),
      inputSchema: { spec: specInputSchema(catalog) },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    // The SDK has already parsed `spec` against the schema above. Unlike
    // `createMcpApp`, it goes back as sent rather than through
    // `catalog.validate`, whose result is stripped the same way.
    async ({ spec }) => ({
      content: [{ type: 'text', text: JSON.stringify(spec) }],
    }),
  );
  await registerJsonRenderResource(server, { resourceUri: RESOURCE_URI, html });
  return server;
}

async function main() {
  if (!process.argv.includes('--http')) {
    const server = await createServerInstance();
    await server.connect(new StdioServerTransport());
    return;
  }

  const port = Number(process.env['PORT'] ?? 3001);
  createServer(async (req, res) => {
    if (!req.url?.startsWith('/mcp')) {
      res.writeHead(404).end();
      return;
    }
    // Stateless: a fresh server and transport per request.
    const server = await createServerInstance();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  }).listen(port, () => {
    console.error(`MCP server on http://localhost:${port}/mcp`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
