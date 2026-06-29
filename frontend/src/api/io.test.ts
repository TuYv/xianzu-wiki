import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./client', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from './client';
import { exportData, importData } from './io';
import type { ImportPayload } from '../types';

const mockedFetch = vi.mocked(apiFetch);

describe('io api', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it('exportData GETs /api/export and returns payload', async () => {
    mockedFetch.mockResolvedValue({ characters: [], relationships: [] });
    const result = await exportData();
    expect(mockedFetch).toHaveBeenCalledWith('/api/export');
    expect(result).toEqual({ characters: [], relationships: [] });
  });

  it('importData POSTs /api/import with the exact JSON payload', async () => {
    mockedFetch.mockResolvedValue({ imported_characters: 2, imported_relationships: 1 });
    const payload: ImportPayload = {
      characters: [{ name: 'A' }, { name: 'B' }],
      relationships: [{ from_name: 'A', to_name: 'B', type: 'spouse' }],
    };
    const result = await importData(payload);

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const [path, opts] = mockedFetch.mock.calls[0];
    expect(path).toBe('/api/import');
    expect(opts?.method).toBe('POST');
    expect(JSON.parse(opts?.body as string)).toEqual(payload);
    expect(result).toEqual({ imported_characters: 2, imported_relationships: 1 });
  });
});
