// The MCP server for the Material catalog, on upstream's @json-render/mcp.
// The `render-ui` tool is registered the way its `createMcpApp` does it (same
// name, same catalog-generated description) with two changes, see
// `specInputSchema` and `VIEW_CSP`. Nothing here is Angular-specific; the only
// Angular part is the view, passed in as HTML.
//
// Entry points: `server.ts` (stdio and a local HTTP server) and `vercel.ts`
// (the hosted endpoint).
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Catalog } from '@json-render/core';
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
// The catalog alone — the build bundles it from source so the server does not
// load the Angular components (and Angular) along with it. See README.md.
import { materialCatalog } from '../../ngx-json-render-material/src/lib/catalog';

export const TOOL_NAME = 'render-ui';
export const RESOURCE_URI = `ui://${TOOL_NAME}/view.html`;

/**
 * What the view may load. `registerJsonRenderResource` allows any `https:`
 * origin; the view only fetches its fonts (Roboto and Material Symbols) from
 * Google Fonts and makes no network requests of its own.
 */
export const VIEW_CSP = {
  resourceDomains: [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
  ],
  connectDomains: [] as string[],
};

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

/** A server exposing the `render-ui` tool and its `ui://` view. */
export function createServerInstance(
  html: string,
  catalog: Catalog = materialCatalog,
) {
  const server = new McpServer({
    name: 'ngx-json-render Material',
    version: '0.1.0',
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
      // It only echoes the spec back for the view to draw: nothing is read
      // from or written to any system.
      annotations: {
        title: 'Render UI',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    // The SDK has already parsed `spec` against the schema above. Unlike
    // `createMcpApp`, it goes back as sent rather than through
    // `catalog.validate`, whose result is stripped the same way.
    async ({ spec }) => ({
      content: [{ type: 'text', text: JSON.stringify(spec) }],
    }),
  );
  registerAppResource(
    server,
    RESOURCE_URI,
    RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => ({
      contents: [
        {
          uri: RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: html,
          _meta: { ui: { csp: VIEW_CSP } },
        },
      ],
    }),
  );
  return server;
}

/**
 * Serve one Streamable HTTP request, statelessly: a fresh server and
 * transport per request, so it runs unchanged on a serverless function.
 */
export async function handleMcpRequest(
  html: string,
  req: IncomingMessage,
  res: ServerResponse,
) {
  // Browser-based clients (MCP Inspector) call the endpoint cross-origin.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
  );
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  const server = createServerInstance(html);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res);
}
