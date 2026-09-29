import { describe, expect, it } from 'vitest';
import { functionKeywords, mergePeople } from './people';
import type { Contact } from './types';

describe('functionKeywords', () => {
  it('keeps single function words and drops the rank', () => {
    expect(functionKeywords(['VP Customer Experience', 'Head of Support', 'COO'])).toEqual(['customer', 'experience', 'support']);
    expect(functionKeywords(['Vice President, Sales', 'Head of Sales Development', 'RevOps Lead'])).toEqual(['sales', 'development', 'revops']);
    expect(functionKeywords(['CTO', 'CEO'])).toEqual([]);
  });
});

describe('mergePeople', () => {
  const c = (id: string): Contact => ({ apolloId: id, firstName: id, lastName: null, lastNameObfuscated: null, title: null, hasEmail: true, rank: null });
  it('keeps the first occurrence in priority order and caps the total', () => {
    const merged = mergePeople([[c('elena'), c('kim')], [c('kim'), c('cameron')], [c('waylon'), c('elena'), c('josh')]], 4);
    expect(merged.map((x) => x.apolloId)).toEqual(['elena', 'kim', 'cameron', 'waylon']);
  });
});
