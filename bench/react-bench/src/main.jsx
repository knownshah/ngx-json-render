import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { JSONUIProvider, Renderer, useStateStore } from '@json-render/react';
import { registry } from './catalog.jsx';
import { PlainNode } from './plain.jsx';
import { runScenario } from '../../shared/scenarios.js';
import { makeSpec, toTree } from '../../shared/spec-gen.js';

const EMPTY_STATE = {};
let stateApi = null;
let setters = null;

// Captures the renderer's own state API (what $bindState inputs use).
function StateTap() {
  stateApi = useStateStore();
  return null;
}

function Bench({ initial }) {
  const [spec, setSpec] = useState(initial.spec);
  const [loading, setLoading] = useState(initial.loading);
  setters = { setSpec, setLoading };
  return (
    <JSONUIProvider
      registry={registry}
      initialState={spec?.state ?? EMPTY_STATE}
    >
      <StateTap />
      <Renderer spec={spec} registry={registry} loading={loading} />
    </JSONUIProvider>
  );
}

let plainSetter = null;
function BenchPlain({ initial }) {
  const [tree, setTree] = useState(initial);
  plainSetter = setTree;
  return <PlainNode node={tree} />;
}

const container = document.getElementById('root');
let root = null;

const adapter = {
  mount(spec, opts) {
    root = createRoot(container);
    flushSync(() =>
      root.render(
        <Bench initial={{ spec, loading: !!(opts && opts.loading) }} />,
      ),
    );
  },
  setSpec(spec) {
    flushSync(() => setters.setSpec(spec));
  },
  setState(path, value) {
    flushSync(() => stateApi.set(path, value));
  },
  unmount() {
    root.unmount();
    root = null;
    stateApi = null;
    setters = null;
  },
  domTextCount() {
    return container.querySelectorAll('span.text').length;
  },
  readLeaf(index) {
    const leaves = container.querySelectorAll('span.text');
    return leaves[index < 0 ? leaves.length + index : index]?.textContent;
  },
  // framework-only baseline
  mountTree(tree) {
    root = createRoot(container);
    flushSync(() => root.render(<BenchPlain initial={tree} />));
  },
  setTree(tree) {
    flushSync(() => plainSetter(tree));
  },
  unmountTree() {
    root.unmount();
    root = null;
    plainSetter = null;
  },
  // helpers for the driver
  mountSize(size, opts) {
    adapter.mount(makeSpec(size, opts));
  },
  mountTreeSize(size) {
    adapter.mountTree(toTree(makeSpec(size)));
  },
  run(name, size, reps) {
    return runScenario(adapter, name, size, reps);
  },
};

window.bench = adapter;
window.benchReady = true;
