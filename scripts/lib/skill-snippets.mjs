/**
 * The pure half of scripts/check-skill-snippets.mjs: reads the fenced code
 * blocks out of a SKILL.md and turns the TypeScript ones into modules that
 * can be compiled together.
 *
 * Every `ts` block becomes its own module, in the order it appears. A block
 * may use what an earlier block declared at top level — `catalog`, `registry`,
 * a component class — without importing it, the way a reader copies the
 * snippets one after another into one project: the stitcher adds the import
 * from the earlier block's module and exports the earlier declaration if the
 * snippet did not. Relative imports (`./catalog`) are dropped for the same
 * reason; what they named is expected to come from an earlier block. Bare
 * package imports stay as written.
 *
 * A block whose info string carries `fragment` (```ts fragment) is an
 * illustrative excerpt rather than a compilable module and is skipped; the
 * runner reports how many were.
 */
import ts from 'typescript';

/**
 * @typedef {{ lang: string, tokens: string[], fenceLine: number, code: string }} Block
 *   fenceLine is the 1-based line of the opening fence; the code starts on
 *   the next line.
 */

/** Splits a Markdown text into its fenced code blocks. @returns {Block[]} */
export function parseBlocks(markdown) {
  const lines = markdown.split('\n');
  const blocks = [];
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!open) {
      const m = /^```(\S*)(.*)$/.exec(line);
      if (!m) continue;
      const tokens = m[2].trim().split(/\s+/).filter(Boolean);
      open = { lang: m[1], tokens, fenceLine: i + 1, codeLines: [] };
    } else if (/^```\s*$/.test(line)) {
      blocks.push({
        lang: open.lang,
        tokens: open.tokens,
        fenceLine: open.fenceLine,
        code: open.codeLines.join('\n') + '\n',
      });
      open = null;
    } else {
      open.codeLines.push(line);
    }
  }
  if (open) {
    throw new Error(
      `unterminated code fence opened at line ${open.fenceLine}: a block that never closes would take every later snippet with it`,
    );
  }
  return blocks;
}

/** Whether a block is TypeScript, compiled or fragment. */
export function isTypeScript(block) {
  return block.lang === 'ts' || block.lang === 'typescript';
}

/** The blocks the checker compiles: TypeScript and not marked `fragment`. */
export function isCompiled(block) {
  return isTypeScript(block) && !block.tokens.includes('fragment');
}

/**
 * Whether an identifier node names something rather than referring to it: a
 * property, a member, a label, or the name in a declaration.
 */
function isNamePosition(node) {
  const p = node.parent;
  if (!p) return false;
  if (ts.isPropertyAccessExpression(p) && p.name === node) return true;
  if (ts.isQualifiedName(p) && p.right === node) return true;
  if (ts.isBindingElement(p) && p.propertyName === node) return true;
  if (ts.isLabeledStatement(p) || ts.isBreakOrContinueStatement(p)) return true;
  if (ts.isShorthandPropertyAssignment(p)) return false;
  if (
    (ts.isPropertyAssignment(p) ||
      ts.isPropertyDeclaration(p) ||
      ts.isMethodDeclaration(p) ||
      ts.isPropertySignature(p) ||
      ts.isMethodSignature(p) ||
      ts.isEnumMember(p) ||
      ts.isGetAccessor(p) ||
      ts.isSetAccessor(p)) &&
    p.name === node
  ) {
    return true;
  }
  return isBindingName(node);
}

/**
 * Whether an identifier node is the name a declaration binds in scope — a
 * variable, parameter, function, class, type, import — as opposed to a
 * property name, which binds nothing a later reference could resolve to.
 */
function isBindingName(node) {
  const p = node.parent;
  if (!p) return false;
  return (
    (ts.isVariableDeclaration(p) ||
      ts.isParameter(p) ||
      ts.isFunctionDeclaration(p) ||
      ts.isFunctionExpression(p) ||
      ts.isClassDeclaration(p) ||
      ts.isClassExpression(p) ||
      ts.isInterfaceDeclaration(p) ||
      ts.isTypeAliasDeclaration(p) ||
      ts.isEnumDeclaration(p) ||
      ts.isModuleDeclaration(p) ||
      ts.isTypeParameterDeclaration(p) ||
      ts.isBindingElement(p) ||
      ts.isImportSpecifier(p) ||
      ts.isImportClause(p) ||
      ts.isNamespaceImport(p)) &&
    p.name === node
  );
}

/** Names bound by a binding pattern (`{ registry }`, `[a, b]`), recursively. */
function bindingNames(name, out) {
  if (ts.isIdentifier(name)) out.push(name.text);
  else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    for (const el of name.elements) {
      if (ts.isBindingElement(el)) bindingNames(el.name, out);
    }
  }
  return out;
}

/**
 * What a block declares at top level, whether each is exported, what it
 * imports, and which identifiers it references without declaring anywhere.
 */
export function analyzeBlock(code, fileName = 'block.ts') {
  const sf = ts.createSourceFile(
    fileName,
    code,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS,
  );
  /** @type {Map<string, boolean>} top-level name → exported */
  const topLevel = new Map();
  const declared = new Set();
  const referenced = new Set();
  /** @type {{ statement: ts.ImportDeclaration, relative: boolean }[]} */
  const imports = [];

  for (const st of sf.statements) {
    const exported =
      (ts.getCombinedModifierFlags(st) & ts.ModifierFlags.Export) !== 0;
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        for (const n of bindingNames(d.name, [])) topLevel.set(n, exported);
      }
    } else if (
      (ts.isClassDeclaration(st) ||
        ts.isFunctionDeclaration(st) ||
        ts.isInterfaceDeclaration(st) ||
        ts.isTypeAliasDeclaration(st) ||
        ts.isEnumDeclaration(st)) &&
      st.name
    ) {
      topLevel.set(st.name.text, exported);
    } else if (
      ts.isImportDeclaration(st) &&
      ts.isStringLiteral(st.moduleSpecifier)
    ) {
      imports.push({
        statement: st,
        relative: st.moduleSpecifier.text.startsWith('.'),
      });
    }
  }

  const visit = (node) => {
    if (ts.isIdentifier(node)) {
      if (isBindingName(node)) declared.add(node.text);
      else if (!isNamePosition(node)) referenced.add(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  // Names a relative import brought in are not declared here: they must
  // come from an earlier block, so they count as references.
  for (const imp of imports) {
    if (!imp.relative) continue;
    const clause = imp.statement.importClause;
    if (!clause) continue;
    if (clause.name)
      (declared.delete(clause.name.text), referenced.add(clause.name.text));
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const s of clause.namedBindings.elements) {
        declared.delete(s.name.text);
        referenced.add(s.name.text);
      }
    }
  }

  const free = new Set([...referenced].filter((n) => !declared.has(n)));
  return { topLevel, free, imports };
}

/**
 * Turns the compiled blocks of one skill into module sources.
 *
 * @param {Block[]} blocks  all blocks of the skill, in order
 * @param {string} skill    the skill name, used in file names
 * @returns {{ files: { name: string, source: string, fenceLine: number, injectedLines: number }[], skipped: number }}
 */
export function stitch(blocks, skill) {
  /** @type {Map<string, string>} top-level name → module name (without .ts) that provides it */
  const provided = new Map();
  const files = [];
  let skipped = 0;
  let index = 0;
  for (const block of blocks) {
    if (!isTypeScript(block)) continue;
    if (!isCompiled(block)) {
      skipped++;
      continue;
    }
    index++;
    const name = `${skill}.block-${String(index).padStart(2, '0')}`;
    const { topLevel, free, imports } = analyzeBlock(block.code, `${name}.ts`);

    // Imports to add, grouped by the providing module.
    /** @type {Map<string, Set<string>>} */
    const needed = new Map();
    for (const id of free) {
      if (topLevel.has(id)) continue;
      const from = provided.get(id);
      if (!from || from === name) continue;
      if (!needed.has(from)) needed.set(from, new Set());
      needed.get(from).add(id);
    }
    const header = [...needed]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([from, ids]) =>
          `import { ${[...ids].sort().join(', ')} } from './${from}';`,
      );

    // Drop relative imports from the snippet itself.
    let code = block.code;
    const drops = imports
      .filter((i) => i.relative)
      .map((i) => [i.statement.getFullStart(), i.statement.getEnd()])
      .sort((a, b) => b[0] - a[0]);
    for (const [start, end] of drops) {
      // Keep the line structure so error lines still map back to the skill.
      const removed = code.slice(start, end);
      code =
        code.slice(0, start) + removed.replace(/[^\n]/g, '') + code.slice(end);
    }

    // Export what the snippet declared but did not export, so later blocks
    // can import it.
    const unexported = [...topLevel]
      .filter(([, exported]) => !exported)
      .map(([n]) => n);
    const footer = unexported.length
      ? [`export { ${unexported.sort().join(', ')} };`]
      : [];

    for (const [n] of topLevel) provided.set(n, name);

    const source =
      [...header, code.replace(/\n$/, ''), ...footer].join('\n') + '\n';
    files.push({
      name: `${name}.ts`,
      source,
      fenceLine: block.fenceLine,
      injectedLines: header.length,
    });
  }
  return { files, skipped };
}

/**
 * Maps a `file.ts:line:col` reported by the compiler back to the skill file
 * and line, given the files `stitch` produced.
 */
export function mapLocation(files, skillPath, fileName, line) {
  const f = files.find((x) => x.name === fileName);
  if (!f) return null;
  const codeLine = line - f.injectedLines; // 1-based line inside the snippet
  return { path: skillPath, line: f.fenceLine + Math.max(codeLine, 1) };
}
