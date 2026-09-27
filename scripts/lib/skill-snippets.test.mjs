import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  analyzeBlock,
  isCompiled,
  mapLocation,
  parseBlocks,
  stitch,
} from './skill-snippets.mjs';

const md = `# Skill

\`\`\`bash
npm install thing
\`\`\`

\`\`\`ts
// catalog.ts
import { schema } from 'ngx-json-render';
export const catalog = schema.createCatalog({ components: {}, actions: {} });
\`\`\`

\`\`\`ts
import { Component } from '@angular/core';
import { defineRegistry } from 'ngx-json-render';
import { catalog } from './catalog';

const { registry } = defineRegistry(catalog, { components: {} });

@Component({ selector: 'x', template: '' })
export class Page {
  readonly registry = registry;
  readonly title = 'x';
}
\`\`\`

\`\`\`ts fragment
readonly directives = [...standardDirectives];
\`\`\`

\`\`\`json
{ "a": 1 }
\`\`\`

\`\`\`ts
export const again = registry;
\`\`\`
`;

test('parseBlocks keeps the language, the info tokens and the fence line', () => {
  const blocks = parseBlocks(md);
  assert.deepEqual(
    blocks.map((b) => [b.lang, b.tokens, b.fenceLine]),
    [
      ['bash', [], 3],
      ['ts', [], 7],
      ['ts', [], 13],
      ['ts', ['fragment'], 27],
      ['json', [], 31],
      ['ts', [], 35],
    ],
  );
  assert.equal(
    blocks[1].code,
    "// catalog.ts\nimport { schema } from 'ngx-json-render';\nexport const catalog = schema.createCatalog({ components: {}, actions: {} });\n",
  );
});

test('isCompiled takes ts blocks and leaves fragments and other languages', () => {
  const blocks = parseBlocks(md);
  assert.deepEqual(blocks.map(isCompiled), [
    false,
    true,
    true,
    false,
    false,
    true,
  ]);
});

test('analyzeBlock separates declarations, property names and free references', () => {
  const { topLevel, free } = analyzeBlock(parseBlocks(md)[2].code);
  assert.deepEqual(
    [...topLevel],
    [
      ['registry', false],
      ['Page', true],
    ],
  );
  // `catalog` came from a relative import, so it is free; `registry`, `title`
  // and `Component` are not.
  assert.ok(free.has('catalog'));
  assert.ok(!free.has('registry'));
  assert.ok(!free.has('title'));
  assert.ok(!free.has('Component'));
});

test('stitch imports earlier declarations, drops relative imports and exports what later blocks need', () => {
  const { files, skipped } = stitch(parseBlocks(md), 'demo');
  assert.equal(skipped, 1);
  assert.deepEqual(
    files.map((f) => f.name),
    ['demo.block-01.ts', 'demo.block-02.ts', 'demo.block-03.ts'],
  );

  const second = files[1].source;
  assert.match(second, /^import \{ catalog \} from '\.\/demo\.block-01';\n/);
  assert.ok(!second.includes("from './catalog'"), second);
  assert.match(second, /\nexport \{ registry \};\n$/);
  assert.equal(files[1].injectedLines, 1);

  const third = files[2].source;
  assert.match(third, /^import \{ registry \} from '\.\/demo\.block-02';\n/);
});

test('a dropped relative import keeps its line so errors map back to the skill', () => {
  const { files } = stitch(parseBlocks(md), 'demo');
  const lines = files[1].source.split('\n');
  // header (1 line) + the snippet's lines in place: line 4 of the snippet was the relative import
  assert.equal(lines[1 + 3].trim(), '');
  assert.deepEqual(
    mapLocation(files, 'skills/demo/SKILL.md', 'demo.block-02.ts', 1 + 6),
    {
      path: 'skills/demo/SKILL.md',
      line: 13 + 6,
    },
  );
});

test('a block that redeclares a name keeps its own declaration', () => {
  const twice =
    '```ts\nexport const registry = 1;\n```\n\n```ts\nexport const registry = 2;\nexport const use = registry;\n```\n';
  const { files } = stitch(parseBlocks(twice), 'demo');
  assert.ok(
    !files[1].source.includes("from './demo.block-01'"),
    files[1].source,
  );
});
