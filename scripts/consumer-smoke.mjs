/**
 * Installs the renderer the way a consumer gets it — `npm pack` of the built
 * `dist/ngx-json-render`, compiled here on the Angular line the workspace
 * pins — into a fresh application on another Angular line, builds that app
 * with strict templates, and drives it in a browser.
 *
 * `angular-compat` compiles the library's *sources* on the target line. What
 * ships is different: partial declarations emitted by the pinned compiler,
 * linked by the consumer's, with `.d.ts` files read by the consumer's
 * TypeScript. That is the path this checks. It is also the only runtime
 * evidence for Angular 19, whose CLI has no unit-test builder to run the
 * library's own suite on.
 *
 * Usage: npm run build:lib
 *        CHROMIUM_PATH=/usr/bin/google-chrome node scripts/consumer-smoke.mjs 19
 *
 * The app is created in a temporary directory, printed first and removed only
 * when every check passed, so a failure leaves it behind to inspect.
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';

const major = process.argv[2];
if (!/^\d+$/.test(major ?? '')) {
  console.error('usage: node scripts/consumer-smoke.mjs <angular-major>');
  process.exit(1);
}

// Each Angular line peers on its own TypeScript window, so the consumer gets
// the one its Angular accepts, not the workspace's. Mirrors angular-compat.mjs.
const TYPESCRIPT = {
  19: '~5.8.0',
  20: '~5.8.0',
  21: '~5.9.0',
  22: '~6.0.0',
};
if (!TYPESCRIPT[major]) {
  console.error(
    `No TypeScript pin for Angular ${major}; add one to TYPESCRIPT.`,
  );
  process.exit(1);
}

const chromium = process.env.CHROMIUM_PATH;
if (!chromium || !existsSync(chromium)) {
  console.error(
    'Set CHROMIUM_PATH to a Chrome or Chromium executable (on GitHub runners: /usr/bin/google-chrome).',
  );
  process.exit(1);
}

const lib = resolve('dist/ngx-json-render');
if (!existsSync(join(lib, 'package.json'))) {
  console.error(
    'dist/ngx-json-render is missing; run `npm run build:lib` first.',
  );
  process.exit(1);
}

const root = JSON.parse(readFileSync('package.json', 'utf8'));
const pinned = (name) =>
  root.dependencies[name] ??
  root.devDependencies[name] ??
  (() => {
    throw new Error(`package.json pins no ${name}`);
  })();

const dir = mkdtempSync(join(tmpdir(), `ngx-json-render-ng${major}-`));
console.log(`Consumer app on Angular ${major}: ${dir}`);

const env = { ...process.env, NG_CLI_ANALYTICS: 'false' };
/** Runs a command in the app and returns its output. */
const run = (cmd, args) =>
  execFileSync(cmd, args, {
    cwd: dir,
    env,
    stdio: ['ignore', 'pipe', 'inherit'],
  })
    .toString()
    .trim();
/** Runs a command in the app with its output passed through, exiting on failure. */
const step = (cmd, args) => {
  try {
    execFileSync(cmd, args, { cwd: dir, env, stdio: 'inherit' });
  } catch {
    console.error(`\n\`${cmd} ${args.join(' ')}\` failed; app left in ${dir}`);
    process.exit(1);
  }
};

const tarball = run('npm', ['pack', lib, '--pack-destination', dir, '--silent'])
  .split('\n')
  .pop();

const write = (path, content) => {
  mkdirSync(join(dir, path, '..'), { recursive: true });
  writeFileSync(
    join(dir, path),
    typeof content === 'string' ? content : JSON.stringify(content, null, 2),
  );
};

const ng = `^${major}.0.0`;
write('package.json', {
  name: 'consumer-smoke',
  private: true,
  dependencies: {
    '@angular/common': ng,
    '@angular/compiler': ng,
    '@angular/core': ng,
    '@angular/platform-browser': ng,
    '@json-render/core': pinned('@json-render/core'),
    'ngx-json-render': `file:./${tarball}`,
    rxjs: pinned('rxjs'),
    tslib: pinned('tslib'),
    zod: pinned('zod'),
  },
  devDependencies: {
    '@angular/build': ng,
    '@angular/cli': ng,
    '@angular/compiler-cli': ng,
    'playwright-core': '^1.50.0',
    typescript: TYPESCRIPT[major],
  },
});

write('angular.json', {
  version: 1,
  cli: { analytics: false },
  projects: {
    smoke: {
      projectType: 'application',
      root: '',
      sourceRoot: 'src',
      architect: {
        build: {
          builder: '@angular/build:application',
          options: {
            outputPath: 'dist',
            index: 'src/index.html',
            browser: 'src/main.ts',
            tsConfig: 'tsconfig.json',
            polyfills: [],
            optimization: true,
            outputHashing: 'none',
          },
        },
      },
    },
  },
});

write('tsconfig.json', {
  compilerOptions: {
    strict: true,
    target: 'ES2022',
    module: 'ES2022',
    moduleResolution: 'bundler',
    lib: ['ES2022', 'dom'],
    isolatedModules: true,
    // The library's .d.ts files come from a newer TypeScript than this one;
    // checking them is part of the point.
    skipLibCheck: false,
  },
  angularCompilerOptions: {
    strictTemplates: true,
    strictInjectionParameters: true,
  },
  files: ['src/main.ts'],
});

write(
  'src/index.html',
  '<!doctype html><html><head><meta charset="utf-8"><title>smoke</title><base href="/"></head><body><app-root></app-root></body></html>\n',
);

// Zoneless on every line: `provideExperimentalZonelessChangeDetection` on 19,
// `provideZonelessChangeDetection` from 20. Pick by major, since a named
// import of the missing one fails this app's build rather than the library's.
const zoneless =
  Number(major) < 20
    ? 'provideExperimentalZonelessChangeDetection'
    : 'provideZonelessChangeDetection';

write(
  'src/main.ts',
  `import { Component, signal, ${zoneless} } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  JrChildren,
  JsonRenderer,
  type Spec,
  defineRegistry,
  injectRenderContext,
  schema,
} from 'ngx-json-render';
// Type-only: resolves the testing entry point's declarations without pulling
// TestBed into a production bundle.
import type { renderSpec } from 'ngx-json-render/testing';
import { z } from 'zod';

export type RenderSpec = typeof renderSpec;

const catalog = schema.createCatalog({
  components: {
    Card: {
      props: z.object({ title: z.string().optional() }),
      slots: ['default'],
      description: 'A container',
    },
    Button: {
      props: z.object({ label: z.string() }),
      slots: [],
      description: "Emits 'press'",
    },
    Text: {
      props: z.object({ content: z.string(), id: z.string().optional() }),
      slots: [],
      description: 'A line of text',
    },
  },
  actions: {},
});

@Component({
  selector: 'app-card',
  imports: [JrChildren],
  template: \`<section>@if (ctx.props().title; as title) { <h3>{{ title }}</h3> }<jr-children /></section>\`,
})
class CardComponent {
  readonly ctx = injectRenderContext<{ title?: string }>();
}

@Component({
  selector: 'app-button',
  template: \`<button type="button" (click)="ctx.emit('press')">{{ ctx.props().label }}</button>\`,
})
class ButtonComponent {
  readonly ctx = injectRenderContext<{ label: string }>();
}

@Component({
  selector: 'app-text',
  template: \`<p [attr.data-id]="ctx.props().id ?? null">{{ ctx.props().content }}</p>\`,
})
class TextComponent {
  readonly ctx = injectRenderContext<{ content: string; id?: string }>();
}

const { registry } = defineRegistry(catalog, {
  components: { Card: CardComponent, Button: ButtonComponent, Text: TextComponent },
  actions: {},
});

@Component({
  selector: 'app-root',
  imports: [JsonRenderer],
  template: \`<json-render [spec]="spec()" [registry]="registry" />\`,
})
class App {
  readonly registry = registry;
  readonly spec = signal<Spec>({
    root: 'root',
    state: { count: 0, items: [{ id: 'a', label: 'alpha' }, { id: 'b', label: 'beta' }] },
    elements: {
      root: {
        type: 'Card',
        props: { title: 'Consumer smoke' },
        children: ['increment', 'add', 'count', 'shown', 'list'],
      },
      increment: {
        type: 'Button',
        props: { label: 'Increment' },
        on: { press: { action: 'setState', params: { statePath: '/count', value: 1 } } },
      },
      add: {
        type: 'Button',
        props: { label: 'Add' },
        on: {
          press: {
            action: 'pushState',
            params: { statePath: '/items', value: { id: 'c', label: 'gamma' } },
          },
        },
      },
      count: { type: 'Text', props: { id: 'count', content: { $template: 'count=\${/count}' } } },
      shown: {
        type: 'Text',
        props: { id: 'shown', content: 'visible' },
        visible: { $state: '/count', gte: 1 },
      },
      list: { type: 'Card', props: {}, repeat: { statePath: '/items', key: 'id' }, children: ['item'] },
      item: { type: 'Text', props: { id: 'item', content: { $item: 'label' } } },
    },
  } as Spec);
}

bootstrapApplication(App, { providers: [${zoneless}()] }).catch((err) => console.error(err));
`,
);

step('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error']);
step('npx', ['ng', 'build']);
console.log(
  `Built against ${run('node', ['-p', "require('@angular/core/package.json').version"])}.`,
);

// Serve the build and drive it.
const out = join(dir, 'dist', 'browser');
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
};
const server = createServer((req, res) => {
  const path = normalize(
    decodeURIComponent(new URL(req.url, 'http://x').pathname),
  );
  let file = join(out, path);
  if (!file.startsWith(out) || !existsSync(file) || path === '/') {
    file = join(out, 'index.html');
  }
  res.setHeader(
    'content-type',
    types[extname(file)] ?? 'application/octet-stream',
  );
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${server.address().port}/`;

const { chromium: browserType } = createRequire(join(dir, 'package.json'))(
  'playwright-core',
);
const browser = await browserType.launch({ executablePath: chromium });
const failures = [];
try {
  const page = await browser.newPage();
  const logged = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') logged.push(m.text());
  });
  page.on('pageerror', (e) => logged.push(String(e)));

  await page.goto(url);
  const text = (id) => page.locator(`[data-id="${id}"]`).allTextContents();
  const expectText = async (label, id, expected) => {
    try {
      await page.waitForFunction(
        ([sel, want]) =>
          JSON.stringify(
            [...document.querySelectorAll(sel)].map((e) =>
              e.textContent.trim(),
            ),
          ) === want,
        [`[data-id="${id}"]`, JSON.stringify(expected)],
        { timeout: 5000 },
      );
    } catch {
      failures.push(
        `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(await text(id))}`,
      );
    }
  };

  await expectText('first render', 'count', ['count=0']);
  await expectText('hidden until count >= 1', 'shown', []);
  await expectText('repeat over state', 'item', ['alpha', 'beta']);

  await page.getByRole('button', { name: 'Increment' }).click();
  await expectText('setState re-renders the template', 'count', ['count=1']);
  await expectText('visibility follows state', 'shown', ['visible']);

  await page.getByRole('button', { name: 'Add' }).click();
  await expectText('pushState grows the repeat', 'item', [
    'alpha',
    'beta',
    'gamma',
  ]);

  for (const line of logged) failures.push(`console: ${line}`);
} finally {
  await browser.close();
  server.close();
}

if (failures.length > 0) {
  console.error(
    `\nAngular ${major} consumer smoke failed:\n  ${failures.join('\n  ')}`,
  );
  console.error(`App left in ${dir}`);
  process.exit(1);
}
rmSync(dir, { recursive: true, force: true });
console.log(
  `Angular ${major} consumer smoke passed: render, setState, visibility, repeat, pushState.`,
);
