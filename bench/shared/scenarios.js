// Benchmark scenarios. `adapter` is implemented per framework:
//   adapter.mount(spec)        -> render a fresh renderer with `spec`, flushed
//   adapter.setSpec(spec)      -> hand the renderer a new spec object, flushed
//   adapter.setState(path, v)  -> write through the renderer's own state API, flushed
//   adapter.unmount()          -> destroy the tree, flushed
//   adapter.domTextCount()     -> number of rendered text leaves (sanity check)
//   adapter.readLeaf(i)        -> text of the i-th rendered leaf, negative from the end (sanity check)
// Every call is synchronous and includes the framework's render flush, so
// performance.now() around it measures JS work for the update; painting is
// not included on either side.

import {
  makeSpec,
  makeDeepSpec,
  makeRepeatSpec,
  replaceLeafContent,
  sameSpecNewObject,
  addElement,
  appendChild,
  streamSteps,
  countElements,
  listsFor,
  PER_LIST,
  leafCount,
  lastLeafKey,
  treeDepth,
  toTree,
  replaceLeafInTree,
  lastLeafPath,
  sameTreeNewObject,
  treeLeafCount,
} from './spec-gen.js';

const now = () => performance.now();

function timed(fn) {
  const t0 = now();
  fn();
  return now() - t0;
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function assert(cond, msg) {
  if (!cond) throw new Error('bench sanity check failed: ' + msg);
}

// --- scenarios: each returns { value, unit, checks } for one size ---

export const scenarios = {
  // Cold-ish mount of N elements (median of `reps` mount/unmount cycles).
  mount(adapter, size, reps) {
    const spec = makeSpec(size);
    const times = [];
    for (let i = 0; i < reps; i++) {
      times.push(timed(() => adapter.mount(spec)));
      assert(adapter.domTextCount() === leafCount(spec), 'mount leaf count');
      adapter.unmount();
    }
    return {
      value: median(times),
      unit: 'ms',
      first: times[0],
      n: countElements(spec),
    };
  },

  // Replace the content of one deep leaf; only that leaf's text must change.
  patchLeaf(adapter, size, reps) {
    let spec = makeSpec(size);
    adapter.mount(spec);
    const key = `t${listsFor(size) - 1}_${PER_LIST - 1}`; // last leaf
    const times = [];
    for (let i = 0; i < reps; i++) {
      const next = replaceLeafContent(spec, key, `edited ${i}`);
      times.push(timed(() => adapter.setSpec(next)));
      assert(adapter.readLeaf(-1) === `edited ${i}`, 'patched leaf text');
      spec = next;
    }
    adapter.unmount();
    return { value: median(times), unit: 'ms', n: countElements(spec) };
  },

  // A new spec object whose elements are all the same objects: nothing to draw.
  sameSpec(adapter, size, reps) {
    const spec = makeSpec(size);
    adapter.mount(spec);
    const times = [];
    for (let i = 0; i < reps; i++) {
      const next = sameSpecNewObject(spec);
      times.push(timed(() => adapter.setSpec(next)));
    }
    adapter.unmount();
    return { value: median(times), unit: 'ms', n: countElements(spec) };
  },

  // Stream the whole spec from empty, one patch at a time (element add, then
  // append to parent), flushing after every patch. Returns total ms and the
  // average cost of the last 100 patches, when the tree is at full size.
  stream(adapter, size, reps) {
    const totals = [];
    const tails = [];
    for (let r = 0; r < reps; r++) {
      let spec = { root: 'card', elements: {} };
      adapter.mount(spec, { loading: true });
      let total = 0;
      const perPatch = [];
      for (const step of streamSteps(size)) {
        const next =
          step[0] === 'add'
            ? addElement(spec, step[1], step[2])
            : appendChild(spec, step[1], step[2]);
        const t = timed(() => adapter.setSpec(next));
        total += t;
        perPatch.push(t);
        spec = next;
      }
      const tail = perPatch.slice(-100);
      tails.push(tail.reduce((a, b) => a + b, 0) / tail.length);
      totals.push(total);
      assert(adapter.domTextCount() === leafCount(spec), 'streamed leaf count');
      adapter.unmount();
    }
    return {
      value: median(totals),
      unit: 'ms total',
      tailPerPatch: median(tails),
      n: countElements(makeSpec(size)),
    };
  },

  // Same stream, but five patches are applied between flushes, the way both
  // stream hooks actually behave: React batches the setSpec calls of one
  // network chunk into one render, the zoneless scheduler coalesces the
  // signal writes of one chunk into one change-detection pass.
  streamChunked(adapter, size, reps) {
    const CHUNK = 5;
    const totals = [];
    const tails = [];
    for (let r = 0; r < reps; r++) {
      let spec = { root: 'card', elements: {} };
      adapter.mount(spec, { loading: true });
      let total = 0;
      const perFlush = [];
      let pending = 0;
      for (const step of streamSteps(size)) {
        spec =
          step[0] === 'add'
            ? addElement(spec, step[1], step[2])
            : appendChild(spec, step[1], step[2]);
        if (++pending === CHUNK) {
          const next = spec;
          const t = timed(() => adapter.setSpec(next));
          total += t;
          perFlush.push(t);
          pending = 0;
        }
      }
      if (pending) {
        const next = spec;
        const t = timed(() => adapter.setSpec(next));
        total += t;
        perFlush.push(t);
      }
      const tail = perFlush.slice(-20);
      tails.push(tail.reduce((a, b) => a + b, 0) / tail.length);
      totals.push(total);
      assert(
        adapter.domTextCount() === leafCount(spec),
        'chunked streamed leaf count',
      );
      adapter.unmount();
    }
    return {
      value: median(totals),
      unit: 'ms total',
      tailPerPatch: median(tails),
      n: countElements(makeSpec(size)),
    };
  },

  // Every text reads its own state path; write one path.
  stateOne(adapter, size, reps) {
    const spec = makeSpec(size, { bound: true });
    adapter.mount(spec);
    const l = listsFor(size) - 1,
      t = PER_LIST - 1;
    const key = `t${l}_${t}`;
    const times = [];
    for (let i = 0; i < reps; i++) {
      times.push(
        timed(() => adapter.setState(`/items/${l}/${t}`, `written ${i}`)),
      );
      assert(adapter.readLeaf(-1) === `written ${i}`, 'state-bound leaf text');
    }
    adapter.unmount();
    return { value: median(times), unit: 'ms', n: countElements(spec) };
  },

  // Every text reads the same path; write it, so every leaf changes.
  stateAll(adapter, size, reps) {
    const spec = makeSpec(size, { shared: true });
    adapter.mount(spec);
    const times = [];
    for (let i = 0; i < reps; i++) {
      times.push(timed(() => adapter.setState('/title', `shared ${i + 1}`)));
      assert(adapter.readLeaf(0) === `shared ${i + 1}`, 'shared leaf text');
    }
    adapter.unmount();
    return { value: median(times), unit: 'ms', n: countElements(spec) };
  },

  // A list repeating over /todos with `size` items; push one more item.
  repeatAppend(adapter, size, reps) {
    const spec = makeRepeatSpec(size);
    adapter.mount(spec);
    const times = [];
    let todos = spec.state.todos;
    for (let i = 0; i < reps; i++) {
      todos = [...todos, { id: `new${i}`, text: `new ${i}` }];
      const next = todos;
      times.push(timed(() => adapter.setState('/todos', next)));
      assert(adapter.domTextCount() === size + i + 1, 'repeat row count');
    }
    adapter.unmount();
    return { value: median(times), unit: 'ms', n: size };
  },

  // Same as mount, but on a 3-ary tree nested `depth` levels instead of 3.
  mountDeep(adapter, size, reps) {
    const spec = makeDeepSpec(size);
    const times = [];
    for (let i = 0; i < reps; i++) {
      times.push(timed(() => adapter.mount(spec)));
      assert(
        adapter.domTextCount() === leafCount(spec),
        'deep mount leaf count',
      );
      adapter.unmount();
    }
    return {
      value: median(times),
      unit: 'ms',
      first: times[0],
      n: countElements(spec),
      depth: treeDepth(spec),
    };
  },

  // Replace one leaf's content in the deep tree.
  patchLeafDeep(adapter, size, reps) {
    let spec = makeDeepSpec(size);
    adapter.mount(spec);
    const key = lastLeafKey(spec);
    const times = [];
    for (let i = 0; i < reps; i++) {
      const next = replaceLeafContent(spec, key, `edited ${i}`);
      times.push(timed(() => adapter.setSpec(next)));
      assert(adapter.readLeaf(-1) === `edited ${i}`, 'deep patched leaf text');
      spec = next;
    }
    adapter.unmount();
    return {
      value: median(times),
      unit: 'ms',
      n: countElements(spec),
      depth: treeDepth(spec),
    };
  },

  // Destroy a mounted tree of N elements.
  unmount(adapter, size, reps) {
    const spec = makeSpec(size);
    const times = [];
    for (let i = 0; i < reps; i++) {
      adapter.mount(spec);
      times.push(timed(() => adapter.unmount()));
    }
    return { value: median(times), unit: 'ms', n: countElements(spec) };
  },

  // ---- framework-only baseline: same tree, hand-written components, no renderer ----
  // adapter.mountTree(tree) / setTree(tree) / unmountTree() mirror the renderer calls.

  plainMount(adapter, size, reps) {
    const spec = makeSpec(size);
    const tree = toTree(spec);
    const times = [];
    for (let i = 0; i < reps; i++) {
      times.push(timed(() => adapter.mountTree(tree)));
      assert(
        adapter.domTextCount() === treeLeafCount(tree),
        'plain mount leaf count',
      );
      adapter.unmountTree();
    }
    return {
      value: median(times),
      unit: 'ms',
      first: times[0],
      n: countElements(spec),
    };
  },

  plainMountDeep(adapter, size, reps) {
    const spec = makeDeepSpec(size);
    const tree = toTree(spec);
    const times = [];
    for (let i = 0; i < reps; i++) {
      times.push(timed(() => adapter.mountTree(tree)));
      assert(
        adapter.domTextCount() === treeLeafCount(tree),
        'plain deep mount leaf count',
      );
      adapter.unmountTree();
    }
    return {
      value: median(times),
      unit: 'ms',
      first: times[0],
      n: countElements(spec),
      depth: treeDepth(spec),
    };
  },

  plainPatchLeaf(adapter, size, reps) {
    const spec = makeSpec(size);
    let tree = toTree(spec);
    const path = lastLeafPath(tree);
    adapter.mountTree(tree);
    const times = [];
    for (let i = 0; i < reps; i++) {
      const next = replaceLeafInTree(tree, path, `edited ${i}`);
      times.push(timed(() => adapter.setTree(next)));
      assert(adapter.readLeaf(-1) === `edited ${i}`, 'plain patched leaf text');
      tree = next;
    }
    adapter.unmountTree();
    return { value: median(times), unit: 'ms', n: countElements(spec) };
  },

  plainSameTree(adapter, size, reps) {
    const spec = makeSpec(size);
    const tree = toTree(spec);
    adapter.mountTree(tree);
    const times = [];
    for (let i = 0; i < reps; i++) {
      const next = sameTreeNewObject(tree);
      times.push(timed(() => adapter.setTree(next)));
    }
    adapter.unmountTree();
    return { value: median(times), unit: 'ms', n: countElements(spec) };
  },

  plainUnmount(adapter, size, reps) {
    const spec = makeSpec(size);
    const tree = toTree(spec);
    const times = [];
    for (let i = 0; i < reps; i++) {
      adapter.mountTree(tree);
      times.push(timed(() => adapter.unmountTree()));
    }
    return { value: median(times), unit: 'ms', n: countElements(spec) };
  },
};

export function runScenario(adapter, name, size, reps = 5) {
  const fn = scenarios[name];
  if (!fn) throw new Error('unknown scenario ' + name);
  // one warm-up pass at the smallest cost, so JIT and caches are comparable
  return fn(adapter, size, reps);
}
