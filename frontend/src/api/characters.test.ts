import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./client', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from './client';
import {
  listCharacters,
  getCharacter,
  createCharacter,
  updateCharacter,
  deleteCharacter,
} from './characters';

describe('characters api', () => {
  beforeEach(() => {
    (apiFetch as any).mockReset();
    (apiFetch as any).mockResolvedValue(undefined);
  });

  it('listCharacters GETs /characters', async () => {
    (apiFetch as any).mockResolvedValue([]);
    await listCharacters();
    expect(apiFetch).toHaveBeenCalledWith('/characters');
  });

  it('getCharacter GETs /characters/{id}', async () => {
    await getCharacter(5);
    expect(apiFetch).toHaveBeenCalledWith('/characters/5');
  });

  it('createCharacter POSTs JSON body', async () => {
    await createCharacter({ name: '萧寒' });
    expect(apiFetch).toHaveBeenCalledWith(
      '/characters',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: '萧寒' }) }),
    );
  });

  it('updateCharacter PUTs /characters/{id}', async () => {
    await updateCharacter(5, { realm: '金丹' });
    expect(apiFetch).toHaveBeenCalledWith(
      '/characters/5',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ realm: '金丹' }) }),
    );
  });

  it('deleteCharacter DELETEs /characters/{id}', async () => {
    await deleteCharacter(5);
    expect(apiFetch).toHaveBeenCalledWith('/characters/5', { method: 'DELETE' });
  });
});
