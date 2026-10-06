import { provideZonelessChangeDetection } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { Spec } from '@json-render/core';
import type {
  McpUiHostCapabilities,
  McpUiHostContext,
} from '@modelcontextprotocol/ext-apps';
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { mcpCatalog } from '../../server/catalog';
import { App, JSON_RENDER_APP_OPTIONS } from './app';
import { messageText } from './json-render-app';

// Material components hold live handles; tear the module down explicitly.
afterEach(() => {
  TestBed.resetTestingModule();
  document.documentElement.style.colorScheme = '';
});

async function settle(fixture: ComponentFixture<App>) {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    await fixture.whenStable();
  }
}

function create(transport: Transport) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      {
        provide: JSON_RENDER_APP_OPTIONS,
        useValue: { transport, autoResize: false },
      },
    ],
  });
  return TestBed.createComponent(App);
}

/** The app, connected to a real `AppBridge` host over an in-memory pair. */
async function connect(
  hostContext: McpUiHostContext = {},
  hostCapabilities: McpUiHostCapabilities = { message: {} },
) {
  const [hostSide, appSide] = InMemoryTransport.createLinkedPair();
  const bridge = new AppBridge(
    null,
    { name: 'test-host', version: '0' },
    hostCapabilities,
    { hostContext },
  );
  await bridge.connect(hostSide);
  const fixture = create(appSide);
  await settle(fixture);
  return { bridge, fixture, host: fixture.nativeElement as HTMLElement };
}

describe('App', () => {
  it('waits for a spec, then renders it with the Material catalog', async () => {
    const { bridge, fixture, host } = await connect();
    expect(host.textContent).toContain("Waiting for the model's spec");

    await bridge.sendToolResult({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            root: 'card',
            state: { name: 'Ada' },
            elements: {
              card: { type: 'Card', props: { title: 'Hi' }, children: ['t'] },
              t: {
                type: 'Text',
                props: { content: { $template: 'Hello, ${/name}' } },
                children: [],
              },
            },
          }),
        },
      ],
    });
    await settle(fixture);

    expect(host.querySelector('mat-card')).toBeTruthy();
    expect(host.textContent).toContain('Hello, Ada');
  });

  /** Render `spec`, collecting the messages the view posts to the chat. */
  async function render(spec: Spec) {
    const connection = await connect();
    const messages: string[] = [];
    connection.bridge.onmessage = async ({ content }) => {
      for (const block of content) {
        if (block.type === 'text') messages.push(block.text);
      }
      return {};
    };
    await connection.bridge.sendToolResult({
      content: [{ type: 'text', text: JSON.stringify(spec) }],
    });
    await settle(connection.fixture);
    return { ...connection, messages };
  }

  it('posts a button press to the chat as a user message', async () => {
    const { fixture, host, messages } = await render({
      root: 'order',
      state: { order: { plan: 'Pro', seats: 3 } },
      elements: {
        order: {
          type: 'Button',
          props: { label: 'Order' },
          on: {
            press: {
              action: 'sendMessage',
              params: {
                text: 'Order the Pro plan',
                data: { $state: '/order' },
              },
            },
          },
          children: [],
        },
      },
    });

    host.querySelector('button')!.click();
    await settle(fixture);

    expect(messages).toEqual([
      messageText('Order the Pro plan', { plan: 'Pro', seats: 3 }),
    ]);
  });

  it('sends nothing for a sendMessage without text', async () => {
    const { fixture } = await connect();
    const send = vi
      .spyOn(fixture.componentInstance.mcp, 'sendMessage')
      .mockResolvedValue();
    const { sendMessage } = fixture.componentInstance.handlers;

    expect(() => sendMessage!({ text: ' ' })).toThrow(
      'sendMessage needs a non-empty "text" param.',
    );
    await sendMessage!({ text: 'Show more', data: ['not', 'an', 'object'] });
    expect(send).toHaveBeenCalledExactlyOnceWith('Show more', undefined);
  });

  it('posts a form only once it is valid', async () => {
    const { fixture, host, messages } = await render({
      root: 'form',
      state: { form: { email: '' } },
      elements: {
        form: {
          type: 'Stack',
          props: {},
          children: ['email', 'submit'],
        },
        email: {
          type: 'Input',
          props: {
            label: 'Email',
            value: { $bindState: '/form/email' },
            validation: {
              checks: [{ type: 'required', message: 'Email is required' }],
            },
          },
          children: [],
        },
        submit: {
          type: 'Button',
          props: { label: 'Sign up' },
          on: {
            press: {
              action: 'submitForm',
              params: {
                action: 'sendMessage',
                params: {
                  text: 'Sign me up for the beta',
                  data: { $state: '/form' },
                },
              },
            },
          },
          children: [],
        },
      },
    });

    host.querySelector('button')!.click();
    await settle(fixture);
    expect(messages).toEqual([]);
    expect(host.textContent).toContain('Email is required');

    const input = host.querySelector('input')!;
    input.value = 'ada@example.com';
    input.dispatchEvent(new Event('input'));
    await settle(fixture);
    host.querySelector('button')!.click();
    await settle(fixture);

    expect(messages).toEqual([
      messageText('Sign me up for the beta', { email: 'ada@example.com' }),
    ]);
  });

  it('handles exactly the actions the server describes to the model', async () => {
    const { fixture } = await connect();

    expect(Object.keys(fixture.componentInstance.handlers)).toEqual(
      mcpCatalog.actionNames,
    );
    expect(mcpCatalog.prompt()).toContain('- sendMessage: ');
  });

  it("follows the host's theme", async () => {
    const { bridge, fixture } = await connect({ theme: 'dark' });
    expect(document.documentElement.style.colorScheme).toBe('dark');

    await bridge.sendHostContextChange({ theme: 'light' });
    await settle(fixture);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('says so when it cannot reach the host', async () => {
    const fixture = create({
      start: () => Promise.reject(new Error('no host')),
      send: () => Promise.resolve(),
      close: () => Promise.resolve(),
    });
    await settle(fixture);

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Could not connect to the host: no host',
    );
  });
});
