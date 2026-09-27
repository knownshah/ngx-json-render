#!/usr/bin/env node
/**
 * Compiles every TypeScript snippet in skills/<name>/SKILL.md against the
 * built packages, so a skill that no longer matches the public API fails CI
 * instead of teaching an agent code that does not compile.
 *
 * Each `ts` block becomes a module under dist/skill-check/, later blocks may
 * use what earlier ones declared (see scripts/lib/skill-snippets.mjs), and
 * the lot is type-checked by ngc — templates included — with the demo's
 * tsconfig, which maps the package names to dist/. ```ts fragment marks an
 * excerpt that is not meant to compile on its own (a server route for
 * another process, a test fragment with free variables) and is skipped.
 *
 * Prerequisites: `npm run build:lib && npm run build:material`.
 * Usage: node scripts/check-skill-snippets.mjs
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isTypeScript,
  mapLocation,
  parseBlocks,
  stitch,
} from './lib/skill-snippets.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'dist', 'skill-check');

for (const pkg of ['ngx-json-render', 'ngx-json-render-material']) {
  if (!existsSync(join(root, 'dist', pkg, 'package.json'))) {
    console.error(
      `dist/${pkg} is not built; run \`npm run build:lib && npm run build:material\` first.`,
    );
    process.exit(1);
  }
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const skills = readdirSync(join(root, 'skills'), { withFileTypes: true })
  .filter(
    (d) =>
      d.isDirectory() && existsSync(join(root, 'skills', d.name, 'SKILL.md')),
  )
  .map((d) => d.name)
  .sort();

/** @type {{ skill: string, skillPath: string, files: ReturnType<typeof stitch>['files'] }[]} */
const generated = [];
const tsFiles = [];
for (const skill of skills) {
  const skillPath = `skills/${skill}/SKILL.md`;
  let blocks;
  try {
    blocks = parseBlocks(readFileSync(join(root, skillPath), 'utf8'));
  } catch (error) {
    console.error(`${skillPath}: ${error.message}`);
    process.exit(1);
  }
  const { files, skipped } = stitch(blocks, skill);
  for (const f of files) {
    const path = join(outDir, f.name);
    writeFileSync(path, f.source);
    tsFiles.push(path);
  }
  generated.push({ skill, skillPath, files });
  const total = blocks.filter(isTypeScript).length;
  console.log(
    `${skillPath}: ${files.length} of ${total} ts blocks compiled, ${skipped} marked fragment`,
  );
}

if (tsFiles.length === 0) {
  console.error('No TypeScript snippets found under skills/.');
  process.exit(1);
}

const tsconfig = join(outDir, 'tsconfig.json');
writeFileSync(
  tsconfig,
  JSON.stringify(
    {
      extends: join(root, 'projects', 'demo', 'tsconfig.app.json'),
      compilerOptions: { noEmit: true, outDir: join(outDir, 'out') },
      files: tsFiles,
      include: [],
    },
    null,
    2,
  ),
);

// Through node rather than the .bin shim, which is a .cmd on Windows that
// spawnSync will not run without a shell.
const ngc = join(
  root,
  'node_modules',
  '@angular',
  'compiler-cli',
  'bundles',
  'src',
  'bin',
  'ngc.js',
);
const result = spawnSync(process.execPath, [ngc, '-p', tsconfig], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
});
// ngc colours its output whatever the environment says; strip that before mapping.
const output = `${result.stdout}${result.stderr}`.replace(
  /\x1b\[[0-9;]*m/g,
  '',
);

if (result.status === 0) {
  console.log(`All ${tsFiles.length} snippet modules compile.`);
  process.exit(0);
}

// Point each error at the skill file rather than at the generated module.
const lines = output.split('\n').map((line) => {
  const m =
    /^(?:.*[\\/])?([\w.-]+\.block-\d+\.ts)[:(](\d+)[:,](\d+)\)?(.*)$/.exec(
      line,
    );
  if (!m) return line;
  const [, file, ln, col, rest] = m;
  for (const g of generated) {
    const loc = mapLocation(g.files, g.skillPath, file, Number(ln));
    if (loc) return `${loc.path}:${loc.line}:${col}${rest}  [${file}:${ln}]`;
  }
  return line;
});
console.error(lines.join('\n'));
console.error(
  `\nSnippet compilation failed (ngc exit ${result.status}). Generated modules are in dist/skill-check/.`,
);
process.exit(1);
