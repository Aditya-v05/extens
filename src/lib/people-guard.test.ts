import { describe, expect, it, vi } from 'vitest';
import { searchPeople } from './apollo';

describe('searchPeople', () => {
  it('refuses to search without a company id instead of searching all of Apollo', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(searchPeople('k', { organizationId: '' })).rejects.toThrow('company id');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
