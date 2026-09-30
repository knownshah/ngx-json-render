import { provideZonelessChangeDetection } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { App, JSON_RENDER_APP_OPTIONS } from './app';

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
async function connect(hostContext: McpUiHostContext = {}) {
  const [hostSide, appSide] = InMemoryTransport.createLinkedPair();
  const bridge = new AppBridge(
    null,
    { name: 'test-host', version: '0' },
    {},
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
