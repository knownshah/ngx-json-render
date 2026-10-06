import { Component, InjectionToken, effect, inject } from '@angular/core';
import type { ActionHandler } from '@json-render/core';
import type { McpUiTheme } from '@modelcontextprotocol/ext-apps';
import { JsonRenderer } from 'ngx-json-render';
import { materialRegistry } from 'ngx-json-render-material';
import {
  type JsonRenderAppOptions,
  injectJsonRenderApp,
} from './json-render-app';

/** Extra options for the app's connection — tests use it to supply a transport. */
export const JSON_RENDER_APP_OPTIONS = new InjectionToken<JsonRenderAppOptions>(
  'JSON_RENDER_APP_OPTIONS',
);

/**
 * The view an MCP host shows in its iframe: whatever spec the model passed
 * to the `render-ui` tool, rendered with the Material catalog.
 */
@Component({
  selector: 'app-root',
  imports: [JsonRenderer],
  template: `
    @if (mcp.error(); as error) {
      <p class="status error">Could not connect to the host: {{ error.message }}</p>
    } @else if (mcp.spec(); as spec) {
      <json-render
        [spec]="spec"
        [loading]="mcp.loading()"
        [registry]="registry"
        [handlers]="handlers"
      />
    } @else {
      <p class="status">Waiting for the model's spec…</p>
    }
  `,
  styles: `
    :host {
      display: block;
      padding: 16px;
    }
    .status {
      margin: 0;
      font: 14px/1.5 Roboto, system-ui, sans-serif;
      opacity: 0.7;
    }
    .error {
      color: #b3261e;
      opacity: 1;
    }
  `,
})
export class App {
  readonly mcp = injectJsonRenderApp({
    name: 'ngx-json-render',
    version: '0.0.0',
    ...inject(JSON_RENDER_APP_OPTIONS, { optional: true }),
  });
  readonly registry = materialRegistry;

  /**
   * The actions `server/catalog.ts` adds to the Material catalog. A spec's
   * built-in actions (setState, submitForm, …) never reach these.
   */
  readonly handlers: Record<string, ActionHandler> = {
    sendMessage: ({ text, data }) => {
      if (typeof text !== 'string' || !text.trim()) {
        throw new Error('sendMessage needs a non-empty "text" param.');
      }
      const isObject = data && typeof data === 'object' && !Array.isArray(data);
      return this.mcp.sendMessage(
        text,
        isObject ? (data as Record<string, unknown>) : undefined,
      );
    },
  };

  constructor() {
    // Follow the host's light/dark theme: the Material theme is emitted under
    // `color-scheme: light dark`, so setting the scheme switches the palette.
    const applyTheme = (theme: McpUiTheme | undefined) => {
      if (theme) document.documentElement.style.colorScheme = theme;
    };
    this.mcp.app.addEventListener('hostcontextchanged', (context) =>
      applyTheme(context.theme),
    );
    effect(() => {
      if (this.mcp.connected())
        applyTheme(this.mcp.app.getHostContext()?.theme);
    });
  }
}
