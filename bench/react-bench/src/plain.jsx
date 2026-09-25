// The same tree rendered by hand: one memoized component per node, children
// keyed by node key. A patch that copies only the path to the change lets
// memo bail out on every untouched sibling — the idiomatic React shape.
import { memo } from 'react';

export const PlainNode = memo(function PlainNode({ node }) {
  if (node.type === 'Text') {
    return <span className="text">{String(node.props.content ?? '')}</span>;
  }
  const children = node.children.map((c) => <PlainNode key={c.key} node={c} />);
  if (node.type === 'Card') {
    return (
      <section className="card">
        <h3>{node.props.title}</h3>
        {children}
      </section>
    );
  }
  return <ul className="list">{children}</ul>;
});
