import { apiFetch } from './client';
import type { ExportPayload, ImportPayload } from '../types';

export function exportData(): Promise<ExportPayload> {
  return apiFetch<ExportPayload>('/api/export');
}

export function importData(
  p: ImportPayload,
): Promise<{ imported_characters: number; imported_relationships: number }> {
  return apiFetch<{ imported_characters: number; imported_relationships: number }>('/api/import', {
    method: 'POST',
    body: JSON.stringify(p),
  });
}
