import { isDevMode } from '@angular/core';

/** Nesting below this is kept as one leaf, the same cut-off core uses. */
const MAX_FLATTEN_DEPTH = 20;

/** Escape one key for a JSON Pointer: `~` → `~0`, `/` → `~1`. */
export function escapePointerSegment(key: string): string {
  return key.replace(/~/g, '~0').replace(/\//g, '~1');
}

/**
 * Flatten plain objects into a `{ pointer: leaf }` map; arrays and anything
 * that is not a plain object are leaves.
 *
 * Core's `flattenToPointers` does the same but joins keys unescaped, so a key
 * such as `a/b` comes back as `/a/b` and a store write puts it at `a` → `b`.
 * Every path built here is escaped, so it reads back the key it came from.
 */
export function flattenToPointers(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const seen = new Set<object>();
  let warned = false;

  const walk = (
    value: Record<string, unknown>,
    prefix: string,
    depth: number,
  ) => {
    for (const [key, child] of Object.entries(value)) {
      const pointer = `${prefix}/${escapePointerSegment(key)}`;
      if (isPlainObject(child) && !seen.has(child)) {
        if (depth < MAX_FLATTEN_DEPTH) {
          seen.add(child);
          walk(child, pointer, depth + 1);
          continue;
        }
        if (isDevMode() && !warned) {
          warned = true;
          console.warn(
            `[ngx-json-render] state nested deeper than ${MAX_FLATTEN_DEPTH} levels is treated as one value.`,
          );
        }
      }
      result[pointer] = child;
    }
  };

  walk(obj, '', 0);
  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
