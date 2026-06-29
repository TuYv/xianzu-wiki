import { apiFetch } from './client';
import type { Relationship } from '../types';

export function listRelationships(): Promise<Relationship[]> {
  return apiFetch<Relationship[]>('/relationships');
}

export function createRelationship(r: Omit<Relationship, 'id'>): Promise<Relationship> {
  return apiFetch<Relationship>('/relationships', {
    method: 'POST',
    body: JSON.stringify(r),
  });
}

export function deleteRelationship(id: number): Promise<void> {
  return apiFetch<void>(`/relationships/${id}`, { method: 'DELETE' });
}
