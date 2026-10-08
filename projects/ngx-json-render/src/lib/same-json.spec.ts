import { sameJson } from './same-json';

describe('sameJson', () => {
  it('compares plain objects and arrays by content', () => {
    expect(sameJson({ a: [1, { b: 'x' }] }, { a: [1, { b: 'x' }] })).toBe(true);
    expect(sameJson({ a: [1, { b: 'x' }] }, { a: [1, { b: 'y' }] })).toBe(
      false,
    );
    expect(sameJson({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(sameJson({ a: undefined }, { b: undefined })).toBe(false);
    expect(sameJson([1, 2], { 0: 1, 1: 2 })).toBe(false);
    expect(sameJson(Object.create(null), {})).toBe(true);
  });

  it('compares everything else by identity', () => {
    expect(sameJson(new Date(0), new Date(0))).toBe(false);
    expect(sameJson(NaN, NaN)).toBe(true);
    expect(sameJson(1, '1')).toBe(false);
    expect(sameJson(null, {})).toBe(false);
  });

  it('counts a value that refers to itself as different', () => {
    const a: Record<string, unknown> = {};
    a['self'] = a;
    const b: Record<string, unknown> = {};
    b['self'] = b;
    expect(sameJson(a, b)).toBe(false);
  });
});
