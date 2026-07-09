import { describe, expect, it } from 'vitest';
import { mergeColumnOrder, type DisplayColumn } from './ResourceTable';

function col(key: string): DisplayColumn {
  return { key, label: key, kind: 'namespace' };
}

describe('mergeColumnOrder', () => {
  const base = [col('a'), col('b'), col('c')];

  it('returns columns unchanged without a saved order', () => {
    expect(mergeColumnOrder(base, undefined)).toEqual(base);
    expect(mergeColumnOrder(base, [])).toEqual(base);
  });

  it('applies the saved order', () => {
    const merged = mergeColumnOrder(base, ['c', 'a', 'b']);
    expect(merged.map((c) => c.key)).toEqual(['c', 'a', 'b']);
  });

  it('ignores unknown keys from removed/renamed columns', () => {
    const merged = mergeColumnOrder(base, ['gone', 'b']);
    expect(merged.map((c) => c.key)).toEqual(['b', 'a', 'c']);
  });

  it('appends new server-side columns not present in the saved order', () => {
    const merged = mergeColumnOrder([...base, col('new')], ['b', 'a', 'c']);
    expect(merged.map((c) => c.key)).toEqual(['b', 'a', 'c', 'new']);
  });
});
