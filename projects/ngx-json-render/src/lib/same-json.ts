/**
 * Whether two values hold the same JSON content.
 *
 * For telling a value that arrived as a new object from one that changed — a
 * spec element, or a leaf of `spec.state`, when the host hands over a spec
 * built from fresh objects. Plain objects and arrays are compared by what
 * they hold; anything else only by identity, which data parsed from JSON
 * never needs. A container reached twice on the way down counts as
 * different: JSON cannot refer to itself, and treating such a value as
 * changed is what the renderer did before it compared anything.
 */
export function sameJson(
  a: unknown,
  b: unknown,
  seen = new Set<unknown>(),
): boolean {
  if (Object.is(a, b)) return true;
  if (!isPlainContainer(a) || !isPlainContainer(b)) return false;
  if (Array.isArray(a) !== Array.isArray(b) || seen.has(a)) return false;
  seen.add(a);
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every(
    (key) => Object.hasOwn(b, key) && sameJson(a[key], b[key], seen),
  );
}

function isPlainContainer(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return (
    Array.isArray(value) || prototype === Object.prototype || prototype === null
  );
}
