import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listRelationships, createRelationship, deleteRelationship } from './relationships';
import { apiFetch } from './client';

vi.mock('./client', () => ({ apiFetch: vi.fn() }));

describe('relationships api', () => {
  beforeEach(() => vi.mocked(apiFetch).mockReset());

  it('listRelationships GETs /relationships', async () => {
    vi.mocked(apiFetch).mockResolvedValue([]);
    const result = await listRelationships();
    expect(apiFetch).toHaveBeenCalledWith('/relationships');
    expect(result).toEqual([]);
  });

  it('createRelationship POSTs the exact payload', async () => {
    const created = { id: 1, from_id: 2, to_id: 3, type: 'parent', parent_role: 'father', note: null };
    vi.mocked(apiFetch).mockResolvedValue(created);
    const r = await createRelationship({ from_id: 2, to_id: 3, type: 'parent', parent_role: 'father', note: null });
    expect(apiFetch).toHaveBeenCalledWith('/relationships', {
      method: 'POST',
      body: JSON.stringify({ from_id: 2, to_id: 3, type: 'parent', parent_role: 'father', note: null }),
    });
    expect(r).toEqual(created);
  });

  it('deleteRelationship DELETEs the id path', async () => {
    vi.mocked(apiFetch).mockResolvedValue(undefined);
    await deleteRelationship(7);
    expect(apiFetch).toHaveBeenCalledWith('/relationships/7', { method: 'DELETE' });
  });
});
