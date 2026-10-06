import { escapePointerSegment, flattenToPointers } from './pointer';

describe('flattenToPointers', () => {
  it('escapes ~ and / in keys', () => {
    expect(flattenToPointers({ links: { 'a/b': 1, 'c~d': 2 } })).toEqual({
      '/links/a~1b': 1,
      '/links/c~0d': 2,
    });
  });

  it('keeps arrays and class instances as leaves', () => {
    const when = new Date(0);
    const items = [{ id: 1 }];

    expect(flattenToPointers({ items, when })).toEqual({
      '/items': items,
      '/when': when,
    });
  });

  it('keeps nesting past the depth limit as one value, warning once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let deep: Record<string, unknown> = { leaf: true };
    for (let i = 0; i < 25; i++) deep = { n: deep };

    const flat = flattenToPointers({ a: deep, b: deep });

    const pointers = Object.keys(flat);
    expect(pointers).toHaveLength(2);
    expect(pointers[0].split('/')).toHaveLength(22); // '' + 'a' + 20 × 'n'
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('stops at an object it has already walked', () => {
    const loop: Record<string, unknown> = { name: 'x' };
    loop['self'] = loop;

    expect(flattenToPointers({ loop })).toEqual({
      '/loop/name': 'x',
      '/loop/self': loop,
    });
  });
});

describe('escapePointerSegment', () => {
  it('escapes ~ before / so the two never mix', () => {
    expect(escapePointerSegment('~/')).toBe('~0~1');
  });
});
