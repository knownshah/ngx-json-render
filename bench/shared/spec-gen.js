// Shared spec generator. Both benchmark apps import this file, so the two
// renderers receive byte-identical inputs.
//
// Tree shape: Card (root) -> `lists` List elements -> `perList` Text leaves.
// Element count = 1 + lists + lists * perList.

export const PER_LIST = 19;

export function listsFor(target) {
  // 1 + L + L*PER_LIST ≈ target
  return Math.max(1, Math.round((target - 1) / (PER_LIST + 1)));
}

export function makeSpec(target, opts = {}) {
  const lists = listsFor(target);
  const elements = {};
  const rootChildren = [];
  const state = {};
  const bound = opts.bound === true; // every text reads its own state path
  const shared = opts.shared === true; // every text reads the same path
  if (bound) state.items = [];
  if (shared) state.title = 'shared 0';
  for (let l = 0; l < lists; l++) {
    const listKey = `l${l}`;
    const children = [];
    if (bound) state.items.push([]);
    for (let t = 0; t < PER_LIST; t++) {
      const key = `t${l}_${t}`;
      let content;
      if (bound) {
        state.items[l].push(`item ${l}.${t}`);
        content = { $state: `/items/${l}/${t}` };
      } else if (shared) {
        content = { $state: '/title' };
      } else {
        content = `item ${l}.${t}`;
      }
      elements[key] = { type: 'Text', props: { content }, children: [] };
      children.push(key);
    }
    elements[listKey] = { type: 'List', props: {}, children };
    rootChildren.push(listKey);
  }
  elements.card = {
    type: 'Card',
    props: { title: 'Bench' },
    children: rootChildren,
  };
  const spec = { root: 'card', elements };
  if (bound || shared) spec.state = state;
  return spec;
}

export function countElements(spec) {
  return Object.keys(spec.elements).length;
}

/** A repeat spec: one List repeating a Text over /todos with `n` items. */
export function makeRepeatSpec(n) {
  const todos = [];
  for (let i = 0; i < n; i++) todos.push({ id: `id${i}`, text: `todo ${i}` });
  return {
    root: 'card',
    state: { todos },
    elements: {
      card: { type: 'Card', props: { title: 'Todos' }, children: ['list'] },
      list: {
        type: 'List',
        props: {},
        repeat: { statePath: '/todos', key: 'id' },
        children: ['row'],
      },
      row: {
        type: 'Text',
        props: { content: { $item: 'text' } },
        children: [],
      },
    },
  };
}

// --- immutable spec edits, shared by both apps (same object identity rules
// as the json-render patch engines: copy the path to the change, keep the
// rest) ---

export function replaceLeafContent(spec, key, content) {
  const el = spec.elements[key];
  return {
    ...spec,
    elements: {
      ...spec.elements,
      [key]: { ...el, props: { ...el.props, content } },
    },
  };
}

export function sameSpecNewObject(spec) {
  return { ...spec, elements: { ...spec.elements } };
}

export function addElement(spec, key, element) {
  return { ...spec, elements: { ...spec.elements, [key]: element } };
}

export function appendChild(spec, parentKey, childKey) {
  const parent = spec.elements[parentKey];
  return {
    ...spec,
    elements: {
      ...spec.elements,
      [parentKey]: {
        ...parent,
        children: [...(parent.children ?? []), childKey],
      },
    },
  };
}

/**
 * The streaming order a model produces for makeSpec(target): root first,
 * then for each list: the list element, append to root, then each text:
 * element, append to list. Yields [op, key, element?, parentKey?].
 */
export function* streamSteps(target) {
  const lists = listsFor(target);
  yield [
    'add',
    'card',
    { type: 'Card', props: { title: 'Bench' }, children: [] },
  ];
  for (let l = 0; l < lists; l++) {
    const listKey = `l${l}`;
    yield ['add', listKey, { type: 'List', props: {}, children: [] }];
    yield ['append', 'card', listKey];
    for (let t = 0; t < PER_LIST; t++) {
      const key = `t${l}_${t}`;
      yield [
        'add',
        key,
        { type: 'Text', props: { content: `item ${l}.${t}` }, children: [] },
      ];
      yield ['append', listKey, key];
    }
  }
}

/**
 * A full `fanout`-ary tree of Lists with Texts at the leaves, deep enough to
 * hold about `target` elements. Same element types as makeSpec, only nested.
 */
export function makeDeepSpec(target, fanout = 3) {
  // the depth whose element count is closest to target
  const total = (d) => fanout ** d + (fanout ** d - 1) / (fanout - 1);
  let depth = 1;
  while (Math.abs(total(depth + 1) - target) < Math.abs(total(depth) - target))
    depth++;
  const elements = {};
  let counter = 0;
  const build = (level) => {
    if (level === depth) {
      const key = `d${counter++}`;
      elements[key] = {
        type: 'Text',
        props: { content: `leaf ${key}` },
        children: [],
      };
      return key;
    }
    const children = [];
    for (let i = 0; i < fanout; i++) children.push(build(level + 1));
    const key = `n${counter++}`;
    elements[key] =
      level === 0
        ? { type: 'Card', props: { title: 'Deep' }, children }
        : { type: 'List', props: {}, children };
    return key;
  };
  const root = build(0);
  return { root, elements };
}

export function leafCount(spec) {
  let n = 0;
  for (const el of Object.values(spec.elements)) if (el.type === 'Text') n++;
  return n;
}

/** The key of the last Text leaf in document order (leaves are inserted in DFS order). */
export function lastLeafKey(spec) {
  let last;
  for (const [key, el] of Object.entries(spec.elements))
    if (el.type === 'Text') last = key;
  return last;
}

export function treeDepth(spec) {
  const walk = (key) =>
    1 + Math.max(0, ...(spec.elements[key].children ?? []).map(walk));
  return walk(spec.root);
}

// --- framework-only baseline: the same tree as a nested structure, rendered
// by hand-written components without the json-render renderer ---

/** Nest a flat spec into { key, type, props, children: [node] }. Done outside timing. */
export function toTree(spec) {
  const build = (key) => {
    const el = spec.elements[key];
    return {
      key,
      type: el.type,
      props: el.props ?? {},
      children: (el.children ?? []).map(build),
    };
  };
  return build(spec.root);
}

/** Replace one leaf's content, copying only the nodes on the path (structural sharing). */
export function replaceLeafInTree(tree, path, content) {
  if (path.length === 0) return { ...tree, props: { ...tree.props, content } };
  const [i, ...rest] = path;
  const children = tree.children.slice();
  children[i] = replaceLeafInTree(children[i], rest, content);
  return { ...tree, children };
}

/** Index path to the last leaf in document order. */
export function lastLeafPath(tree) {
  const path = [];
  let node = tree;
  while (node.children.length) {
    const i = node.children.length - 1;
    path.push(i);
    node = node.children[i];
  }
  return path;
}

export function sameTreeNewObject(tree) {
  return { ...tree, children: tree.children.slice() };
}

export function treeLeafCount(tree) {
  return tree.children.length
    ? tree.children.reduce((a, c) => a + treeLeafCount(c), 0)
    : 1;
}
