// The React catalog: three components equivalent to the Angular ones.
// The renderer hands each component { element, children, slots, emit, on, bindings, loading }.
export function Card({ element, children }) {
  return (
    <section className="card">
      <h3>{element.props.title}</h3>
      {children}
    </section>
  );
}
export function List({ children }) {
  return <ul className="list">{children}</ul>;
}
export function Text({ element }) {
  return <span className="text">{String(element.props.content ?? '')}</span>;
}
export const registry = { Card, List, Text };
