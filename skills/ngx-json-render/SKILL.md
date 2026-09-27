---
name: ngx-json-render
description: Angular renderer for json-render. Use when rendering AI-generated JSON specs as Angular components, working with ngx-json-render, defining Angular catalogs and component registries, streaming specs with injectUIStream or injectChatUI, checking generated specs, or testing catalog components with ngx-json-render/testing.
---

# ngx-json-render

Angular renderer for [json-render](https://github.com/vercel-labs/json-render). A model (or your server) emits a JSON spec constrained to a catalog of your components, and `<json-render>` renders it as real Angular components. It is an adapter over `@json-render/core`: the same spec grammar, prop expressions, state store, actions and SpecStream patches as `@json-render/react`, `/vue`, `/svelte` and `/solid`, so catalogs and specs move between frameworks unchanged. Standalone components, signals, `OnPush`, zoneless (no Zone.js, no `NgZone`). No `innerHTML`, no `eval`.

## Installation

```bash
npm install ngx-json-render @json-render/core zod
```

Peer dependencies: `@angular/core` and `@angular/common` `>=20`, `@json-render/core`, `zod ^4`. Works in zoneless and Zone.js apps alike.

Nothing to write first? `ngx-json-render-material` is a 28-component Angular Material catalog with a ready registry (`materialRegistry`, `materialCatalog.prompt()`); see its skill.

## Quick Start

### 1. Define a catalog

The catalog is the vocabulary the model may use: components with Zod props, slots and a description, plus optional actions.

```ts
// catalog.ts
import { schema } from 'ngx-json-render';
import { z } from 'zod';

export const catalog = schema.createCatalog({
  components: {
    Card: {
      props: z.object({ title: z.string().optional() }),
      slots: ['default', 'actions'],
      description: 'A card with a body and an "actions" footer',
    },
    Button: {
      props: z.object({ label: z.string() }),
      slots: [],
      description: "A button that emits a 'press' event",
    },
    Input: {
      props: z.object({
        value: z.string().optional(),
        placeholder: z.string().optional(),
      }),
      slots: [],
      description: 'Text input; bind `value` with $bindState',
    },
  },
  actions: {
    refresh: { params: z.object({}), description: 'Reload the data' },
  },
});
```

`schema` is the Angular schema; `defineCatalog(schema, { ... })` from `@json-render/core` is the same call. `catalog.prompt()` is the system prompt (vocabulary, spec grammar, patch protocol; `prompt({ customRules: [...] })` appends rules), `catalog.jsonSchema({ strict: true })` a JSON Schema for structured output, `catalog.validate(spec)` core's spec check.

### 2. Implement catalog components

A catalog component is a plain standalone component with no inputs: it injects the render context.

```ts
import { Component } from '@angular/core';
import { JrChildren, injectRenderContext } from 'ngx-json-render';

@Component({
  selector: 'app-card',
  imports: [JrChildren],
  template: `
    <section class="card">
      @if (ctx.props().title) {
        <h3>{{ ctx.props().title }}</h3>
      }
      <jr-children />
      <footer><jr-children slot="actions" /></footer>
    </section>
  `,
})
export class CardComponent {
  readonly ctx = injectRenderContext<{ title?: string }>();
}

@Component({
  selector: 'app-button',
  template: `<button (click)="ctx.emit('press')">{{ ctx.props().label }}</button>`,
})
export class ButtonComponent {
  readonly ctx = injectRenderContext<{ label: string }>();
}
```

`<jr-children />` renders the element's children in place, like a `router-outlet` for the spec tree; `<jr-children slot="actions" />` renders a named slot. Read `ctx.props()` and `ctx.element()` in templates: those are the signals a state write refreshes.

`RenderContext<P>`, from `injectRenderContext<P>()`:

| Member                  | Purpose                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `props()`               | Resolved props: `$state`, `$template`, `$cond`, directives already evaluated             |
| `element()`             | The resolved `UIElement` (`type`, `props`, `children`, `visible`, `repeat`)              |
| `emit(event)`           | Fire an event; the renderer dispatches the element's `on[event]` bindings                |
| `on(event)`             | `{ emit, bound, shouldPreventDefault }`: render a clickable affordance only when `bound` |
| `bindings()`            | Prop name → state path for `$bindState` / `$bindItem` props, else `undefined`            |
| `setBound(prop, value)` | Write a two-way-bound prop back to state (dev warning if the prop is not bound)          |
| `loading()`             | Whether the spec is still streaming                                                      |

A two-way-bound input writes through `setBound` and syncs the DOM imperatively. A `[value]` binding would skip the write when state returns to a value the DOM already had while the user typed (e.g. `pushState` with `clearStatePath`):

```ts
import { Component, type ElementRef, effect, viewChild } from '@angular/core';
import { injectRenderContext } from 'ngx-json-render';

@Component({
  selector: 'app-input',
  template: `<input
    #el
    [placeholder]="ctx.props().placeholder ?? ''"
    (input)="onInput($event)"
    (keydown.enter)="ctx.emit('submit')"
  />`,
})
export class InputComponent {
  readonly ctx = injectRenderContext<{ value?: string; placeholder?: string }>();
  private readonly el = viewChild.required<ElementRef<HTMLInputElement>>('el');

  constructor() {
    effect(() => {
      const value = String(this.ctx.props().value ?? '');
      const input = this.el().nativeElement;
      if (input.value !== value) input.value = value;
    });
  }

  onInput(event: Event): void {
    this.ctx.setBound('value', (event.target as HTMLInputElement).value);
  }
}
```

Other helpers for catalog components: `injectStateStore()` (the store: `get`, `set`, `update`, `state()`), `injectStateValue<T>(path)` (a `Signal<T | undefined>`), `injectStateBinding<T>(path)` and `injectBoundProp<T>(propValue, bindingPath)` (`{ value, set }`), `injectActions()` / `injectAction(binding)` (`{ execute, isLoading }`; `isActionCancelled(error)` tells a dismissed `confirm` from a failure), `injectFieldValidation(path, config)` (`{ state, errors, validate, touch, clear }`), `injectRepeatScope()`, `injectElementKey()`.

### 3. Build the registry and render

```ts
import { Component, signal } from '@angular/core';
import {
  type ActionHandler,
  JsonRenderer,
  type Spec,
  type StateChange,
  defineRegistry,
} from 'ngx-json-render';
import { catalog } from './catalog';

export const { registry } = defineRegistry(catalog, {
  components: {
    Card: CardComponent,
    Button: ButtonComponent,
    Input: InputComponent,
  },
  actions: { refresh: async () => {} },
});

@Component({
  selector: 'app-page',
  imports: [JsonRenderer],
  template: `
    <json-render
      [spec]="spec()"
      [registry]="registry"
      [handlers]="handlers"
      (stateChange)="onStateChange($event)"
    />
  `,
})
export class Page {
  readonly registry = registry;
  readonly spec = signal<Spec>({
    root: 'root',
    state: { name: '', count: 0 },
    elements: {
      root: {
        type: 'Card',
        props: { title: 'Hello' },
        children: ['name'],
        slots: { actions: ['btn'] },
      },
      name: {
        type: 'Input',
        props: { value: { $bindState: '/name' }, placeholder: 'Your name' },
        children: [],
      },
      btn: {
        type: 'Button',
        props: { label: { $template: 'Tap me, ${/name}' } },
        on: {
          press: {
            action: 'setState',
            params: { statePath: '/count', value: 1 },
          },
        },
        visible: { $state: '/name', neq: '' },
        children: [],
      },
    },
  });
  readonly handlers: Record<string, ActionHandler> = {
    refresh: async () => {},
  };
  onStateChange(changes: StateChange[]): void {}
}
```

`defineRegistry` is typed against the catalog: a component key the catalog does not declare is a compile error, and when the catalog declares actions the `actions` map is required, each handler `(params, setState, state) => Promise<void>`. The renderer runs the handlers passed to `[handlers]` (`Record<string, ActionHandler>`, an `ActionHandler` receives the params); `defineRegistry` also returns `handlers(getSetState, getState)` to adapt its typed map into that shape and `executeAction(name, params, setState)` to run one imperatively.

## Spec structure

```json
{
  "root": "root",
  "state": { "name": "" },
  "elements": {
    "root": {
      "type": "Card",
      "props": { "title": "Profile" },
      "children": ["name"],
      "slots": { "actions": ["save"] }
    },
    "name": {
      "type": "Input",
      "props": { "value": { "$bindState": "/name" } },
      "children": []
    },
    "save": {
      "type": "Button",
      "props": { "label": "Save" },
      "on": { "press": { "action": "refresh" } },
      "visible": { "$state": "/name", "neq": "" },
      "children": []
    }
  }
}
```

- Flat: `elements` is a map keyed by element key and `children` lists keys. Every element has a `children` array, `[]` for leaves.
- `visible`, `on`, `repeat`, `slots` and `watch` sit on the element, never inside `props`.
- `state` on the spec seeds the store unless the renderer is given `state` or `store`.
- Named slots: `"slots": { "actions": ["save"] }` on the element, `slots: ['default', 'actions']` in the catalog, `<jr-children slot="actions" />` in the component. Default content stays in `children`.

## Renderer inputs

| Input                 | Type                                 | Purpose                                                                |
| --------------------- | ------------------------------------ | ---------------------------------------------------------------------- |
| `spec`                | `Spec \| null`                       | The spec; may be partial while streaming                               |
| `registry`            | `ComponentRegistry`                  | Catalog type → Angular component                                       |
| `loading`             | `boolean`                            | Suppress missing-element warnings while streaming                      |
| `fallback`            | `Type<unknown>`                      | Component for unknown types                                            |
| `validate`            | `'off' \| 'warn' \| 'strict'`        | Check the settled spec's structure (default `'off'`)                   |
| `catalog`             | `Catalog`                            | Also check element types and props against the catalog                 |
| `renderLimits`        | `RenderLimits`                       | Cap `maxElements`, `maxDepth`, `maxRepeatItems` (default none)         |
| `state`               | `StateModel`                         | Initial state (uncontrolled; defaults to `spec.state`)                 |
| `store`               | `StateStore`                         | External store (controlled mode)                                       |
| `handlers`            | `Record<string, ActionHandler>`      | Action handlers by name                                                |
| `onAction`            | `(name, params) => unknown`          | Catch-all: every action name reaches it, switch on the ones you expect |
| `navigate`            | `(path) => void`                     | Called by `onSuccess: { navigate }`; treat the path as untrusted       |
| `validationFunctions` | `Record<string, ValidationFunction>` | Custom validation checks                                               |
| `functions`           | `Record<string, ComputedFunction>`   | Functions for `$computed`                                              |
| `directives`          | `DirectiveDefinition[]`              | Custom `$`-prefixed expressions                                        |

Output: `(stateChange)` emits batched `StateChange[]` (`{ path, value }`) in uncontrolled mode.

## Dynamic props and expressions

- `{ "$state": "/user/name" }` reads state (JSON Pointer).
- `{ "$bindState": "/form/email" }` two-way binding; `{ "$bindItem": "done" }` binds a field of the current `repeat` item.
- `{ "$item": "title" }` and `{ "$index": true }` inside a `repeat`.
- `{ "$template": "Hello, ${/user/name}" }`.
- `{ "$cond": { "$state": "/ok" }, "$then": "Yes", "$else": "No" }`.
- `{ "$computed": "fmtDate", "args": { "value": { "$state": "/date" } } }` calls a function from the `functions` input. Keep it pure over its `args`: the renderer re-runs it only when a path in `args` changes.
- Directives are custom `$`-keys passed through the `directives` input. `@json-render/directives` works as is (`$format`, `$math`, `$concat`, `$count`, `$truncate`, `$pluralize`, `$join`, `$t`):

```ts
import { standardDirectives } from '@json-render/directives';
// <json-render [directives]="directives" />
readonly directives = [...standardDirectives];
```

```json
{ "content": { "$format": "currency", "value": { "$state": "/price" }, "currency": "USD" } }
```

A state write re-renders only the elements whose resolved props changed, so templates should read `ctx.props()` / `ctx.element()` rather than anything computed outside the spec.

## Visibility conditions

```json
{ "$state": "/user/isAdmin" }
{ "$state": "/status", "eq": "active" }
{ "$state": "/count", "gte": 5 }
{ "$state": "/maintenance", "not": true }
{ "$item": "done", "eq": false }
{ "$and": [{ "$state": "/a" }, { "$or": [{ "$state": "/b" }, { "$state": "/c" }] }] }
[{ "$state": "/a" }, { "$state": "/b" }]
```

Operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte` (numbers or `{ "$state": "/path" }`), `not: true`. A bare array is an implicit AND; `$item` / `$index` conditions work inside a `repeat`.

## Events → actions

```json
"on": {
  "press": {
    "action": "saveUser",
    "params": { "email": { "$state": "/email" } },
    "confirm": { "title": "Save?", "message": "This overwrites the profile.", "variant": "danger" },
    "onSuccess": { "navigate": "/thanks" },
    "onError": { "set": { "/error": true } }
  }
}
```

- `params` values may be `{ "$state": "/path" }` references.
- `confirm` (`title`, `message`, `confirmLabel?`, `cancelLabel?`, `variant?: 'default' | 'danger'`) routes the action through the built-in `<jr-confirm-dialog>` first. It is a UX affordance the spec chose for itself, not authorization.
- `onSuccess` is `{ navigate }`, `{ set: { "/path": value } }` or `{ action, params }`; `onError` is `{ set }` or `{ action, params }`.
- Several bindings: `"press": [binding1, binding2]`.
- Built-in actions, handled by the renderer: `setState` (`{ statePath, value }`), `pushState` (`{ statePath, value, clearStatePath? }`, `"$id"` in `value` auto-generates an id), `removeState` (`{ statePath, index }`), `push` / `pop` (write `/currentScreen` and `/navStack`), `validateForm` (`{ statePath? }`, writes `{ valid, errors }` to `/formValidation`), `submitForm` (`{ action, params?, statePath? }`: validate every bound field, dispatch `action` only if all pass). Every other name is looked up in `handlers`; an unknown one warns and does nothing.
- `repeat`: `"repeat": { "statePath": "/todos", "key": "id" }` on a container renders its children once per item; nested lists use `"statePath": { "$item": "comments" }`.
- `watch`: `"watch": { "/country": { "action": "loadCities" } }` dispatches when a state path changes.

## State

Each `<json-render>` owns a JSON-Pointer-addressed store. Seeding order: `store` input (controlled) → `state` input → `spec.state`. To share one store across renderers or drive it from your own state management, pass a core `StateStore` (`createStateStore()` or an adapter such as `@json-render/redux`) through `store`; `createStoreSetState(store)` adapts a whole-state updater to fine-grained path writes. In uncontrolled mode `(stateChange)` reports the writes.

Security: a spec chooses its own state paths and `navigate` targets, so give the renderer a store scoped to the generated view (not the one holding session or billing state) and match `navigate` paths against known routes before routing.

## Streaming a UI from a model

Specs stream as JSONL patch lines (RFC 6902). `injectUIStream` applies them to a signal as they arrive, so the UI assembles while the model is still generating:

```ts
import { Component } from '@angular/core';
import { JsonRenderer, injectUIStream } from 'ngx-json-render';

@Component({
  selector: 'app-generate',
  imports: [JsonRenderer],
  template: `
    <json-render
      [spec]="ui.spec()"
      [registry]="registry"
      [loading]="ui.isStreaming()"
      [catalog]="catalog"
      validate="warn"
      [renderLimits]="{ maxElements: 500, maxDepth: 16, maxRepeatItems: 200 }"
    />
    <button (click)="ui.send('A dashboard for weekly sales')">Generate</button>
    @if (ui.isStreaming()) {
      <button (click)="ui.stop()">Stop</button>
    }
  `,
})
export class GeneratePage {
  readonly registry = registry;
  readonly catalog = catalog;
  readonly ui = injectUIStream({
    api: '/api/generate',
    validate: 'strict',
    catalog,
    renderLimits: { maxElements: 500, maxDepth: 16 },
  });

  refine(): void {
    const current = this.ui.spec();
    if (current) {
      void this.ui.send('make the chart a bar chart', {
        previousSpec: current,
        context: { locale: 'en' },
      });
    }
  }
}
```

`injectUIStream(options)` returns signals `spec`, `isStreaming`, `error`, `usage`, `rawLines`, `issues`, and `send(prompt, { context?, previousSpec? })`, `stop()` (keeps what rendered, no error), `clear()`. Options: `api`, `onComplete(spec)`, `onError(error)`, `validate`, `catalog`, `renderLimits`, `fetch` (your own transport, e.g. to add an `Authorization` header). It POSTs `{ prompt, context, currentSpec }` and expects the response body to be SpecStream JSONL.

`injectChatUI({ api })` is the same for a chat whose replies mix prose with ` ```spec ` fenced JSONL. Its endpoint receives `{ messages }`; it returns `messages()` (each `{ id, role, text, spec }`, so earlier turns keep their UI), `isStreaming`, `error`, `issues`, `send(text)`, `stop()`, `clear()`.

```ts
@Component({
  selector: 'app-chat',
  imports: [JsonRenderer],
  template: `
    @for (m of chat.messages(); track m.id) {
      <p>{{ m.text }}</p>
      @if (m.spec) {
        <json-render [spec]="m.spec" [registry]="registry" />
      }
    }
    <button (click)="chat.send('show me revenue for the quarter')">Ask</button>
  `,
})
export class ChatPage {
  readonly chat = injectChatUI({ api: '/api/chat' });
  readonly registry = registry;
}
```

For AI SDK `UIMessage.parts`, `jsonRenderMessage(() => parts)` gives `text()`, `spec()`, `hasSpec()`; `buildSpecFromParts` / `getTextFromParts` are the plain functions. Do not give patch data parts an `id` (a later part with the same id replaces the earlier one), and transient parts never reach `message.parts`. `applyPatch(spec, patch)` applies one RFC 6902 patch immutably.

### Server side

Any server that streams text works. With the AI SDK, `catalog.prompt()` teaches the model the vocabulary and the patch protocol:

```ts
// server.ts (Express)
import express from 'express';
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { catalog } from './catalog';

const app = express();
app.use(express.json());

app.post('/api/generate', async (req, res) => {
  const { prompt } = req.body; // injectUIStream sends { prompt, context, currentSpec }
  const result = streamText({
    model: anthropic('claude-sonnet-5'),
    system: catalog.prompt(),
    prompt,
  });
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  for await (const chunk of result.textStream) res.write(chunk);
  res.end();
});
```

`catalog.ts` imports `schema` from `ngx-json-render`, which loads Angular. In an Angular SSR app (`ng new --ssr`) the route goes into `server.ts` unchanged; on Angular 20 and 21 add `"prebundle": { "exclude": ["zod"] }` to the `serve` options in `angular.json` first, or the dev server answers every request with a 500. A plain Node server (`node`, `tsx`) needs `import '@angular/compiler';` as its first import. Prefer structured output? Use `catalog.jsonSchema({ strict: true })` with `streamObject` or a tool call and render the finished spec.

## Checking what the model produced

- `validate="warn"` on the renderer reports structural problems in the settled spec and renders anyway; `"strict"` refuses a spec with errors, and in the hooks fails the generation instead of calling `onComplete`. Both first apply core's lossless `autoFixSpec` fixes (`visible`, `on`, `repeat` misplaced inside `props` move back onto the element).
- Pass `[catalog]` too and the check also reports element types the catalog does not define and props their component schema rejects. Props written as expressions are not checked.
- `renderLimits` (`maxElements`, `maxDepth`, `maxRepeatItems`) is enforced in every mode, `validate="off"` included, and while streaming. Set all three for specs you did not generate; there are no defaults.
- The same check by hand: `checkSpec(spec, 'strict', { catalog, limits })` returns issues; `formatSpecCheckIssues` prints them.

The renderer never executes code from a spec, only names actions you registered, and breaks render cycles (an element that renders itself without reading deeper into state).

## Confirmation dialogs

`confirm` on a binding opens the packaged accessible modal. Customize its words with the `JR_CONFIRM_LABELS` token (`{ confirm, cancel }`), its colours with the `--jr-confirm-*` CSS variables on `json-render`, or replace it entirely with `JR_CONFIRM_DIALOG` (a component that calls `injectConfirmContext()` for `config`, `confirm()`, `cancel()`).

## Testing (`ngx-json-render/testing`)

A separate entry point, so nothing in it reaches an application bundle.

```ts
import { renderSpec, renderComponent, recordedTransport, specStream, usageLine } from 'ngx-json-render/testing';

const ui = await renderSpec(spec, { registry: { Button: MyButton } });
ui.text('button'); await ui.click('button'); ui.dispatched; // [{ name, params }]
ui.read('/path'); await ui.write('/path', value); await ui.setSpec(next); await ui.settle();

const button = await renderComponent(MyButton, { props: { label: 'Save' } });
await button.click('button'); button.emitted; // ['press']
await button.patchProps({ disabled: true }); button.writes; // setBound calls

const stream = injectUIStream({
  api: '/api/generate',
  fetch: recordedTransport([...specStream(expectedSpec), usageLine({ totalTokens: 15 })]),
});
```

`renderSpec` mounts a spec against a registry with no host component or TestBed module; options mirror the renderer's inputs plus `providers`. `renderComponent` mounts one catalog component with `props`, `bindings` (which props are two-way bound) and `on` (events the spec would bind). `recordedTransport` is a `fetch` that replays recorded JSONL (`Record<prompt, lines>` for per-prompt answers; `delayMs`, `fail`, `promptOf` options); `specStream(spec)` writes the patch lines a model would emit.

## Key Exports

| Export                                                                                                        | Purpose                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JsonRenderer` (`<json-render>`)                                                                              | Render a spec with a registry                                                                                                                                                     |
| `JrChildren` (`<jr-children [slot]>`)                                                                         | Render an element's children or a named slot                                                                                                                                      |
| `schema`                                                                                                      | Angular schema; `schema.createCatalog({ components, actions })`                                                                                                                   |
| `defineRegistry`, `createStoreSetState`                                                                       | Typed registry and handlers from a catalog                                                                                                                                        |
| `injectRenderContext`                                                                                         | Props, element, `emit`, `on`, `bindings`, `setBound`, `loading` in a catalog component                                                                                            |
| `injectStateStore`, `injectStateValue`, `injectStateBinding`, `injectBoundProp`                               | State access inside components                                                                                                                                                    |
| `injectActions`, `injectAction`, `isActionCancelled`                                                          | Dispatch actions imperatively                                                                                                                                                     |
| `injectValidation`, `injectFieldValidation`                                                                   | Field validation in input components                                                                                                                                              |
| `injectUIStream`, `injectChatUI`, `jsonRenderMessage`, `buildSpecFromParts`, `getTextFromParts`, `applyPatch` | Streaming                                                                                                                                                                         |
| `checkSpec`, `formatSpecCheckIssues`                                                                          | Spec checks by hand; types `RenderLimits`, `SpecCheck`, `SpecCheckIssue`                                                                                                          |
| `JR_CONFIRM_DIALOG`, `JR_CONFIRM_LABELS`, `injectConfirmContext`, `JrConfirmDialog`                           | Confirmation dialog                                                                                                                                                               |
| `injectRepeatScope`, `injectElementKey`, `injectDevtoolsActive`                                               | Repeat scope, element key, devtools                                                                                                                                               |
| Re-exported from core                                                                                         | `Spec`, `UIElement`, `ActionBinding`, `ActionHandler`, `StateStore`, `VisibilityCondition`, `createStateStore`, `validateSpec`, `autoFixSpec`, `nestedToFlat`, `formatSpecIssues` |
