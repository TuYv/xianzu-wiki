import { apiFetch } from './client';
import type { Relationship } from '../types';
import { STATIC_DATA, loadSiteData, staticReadOnly } from './staticData';

// ---- 读:静态站读 data.json,本地开发读后端 ----

export async function listRelationships(): Promise<Relationship[]> {
  if (STATIC_DATA) return (await loadSiteData()).relationships;
  return apiFetch<Relationship[]>('/relationships');
}

// ---- 写:仅本地编辑器(连后端)可用;静态站不支持 ----

export async function createRelationship(r: Omit<Relationship, 'id'>): Promise<Relationship> {
  if (STATIC_DATA) staticReadOnly();
  return apiFetch<Relationship>('/relationships', {
    method: 'POST',
    body: JSON.stringify(r),
  });
}

export async function deleteRelationship(id: number): Promise<void> {
  if (STATIC_DATA) staticReadOnly();
  return apiFetch<void>(`/relationships/${id}`, { method: 'DELETE' });
}
