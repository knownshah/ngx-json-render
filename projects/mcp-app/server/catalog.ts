// The catalog the MCP server describes to the model: the Material catalog's
// components, plus actions that only make sense inside an MCP Apps host. The
// published catalog stays host-neutral; these actions need the view's
// handlers in `src/app/app.ts`, which talk to the host.
import { defineCatalog } from '@json-render/core';
import { z } from 'zod';
// From source, like `app.ts`, so the server does not load Angular.
import { materialCatalog } from '../../ngx-json-render-material/src/lib/catalog';

/** Params of the `sendMessage` action. */
export const sendMessageParams = z.object({
  text: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
});

/** Material components plus the MCP Apps actions the view handles. */
export const mcpCatalog = defineCatalog(materialCatalog.schema, {
  ...materialCatalog.data,
  actions: {
    sendMessage: {
      params: sendMessageParams,
      description:
        'Send a message to you, the assistant, as the user, so the conversation continues from the UI. ' +
        'Params: { "text": "what the user chose or asks for", "data"?: { "$state": "/path" } }. `data` is optional and is attached as JSON; ' +
        'make it a single reference to a state object, because references nested inside `data` are not resolved. ' +
        'Use it for choices and follow-ups ("Approve", "Show more", a picked option). ' +
        'To send a form, gate it with submitForm: ' +
        '{ "action": "submitForm", "params": { "action": "sendMessage", "params": { "text": "Submit the sign-up form", "data": { "$state": "/form" } } } }. ' +
        "The message appears in the chat as the user's, so write `text` in their voice.",
    },
  },
});
