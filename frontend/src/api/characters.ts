import { apiFetch } from './client';
import type { Character, CharacterDetail } from '../types';
import { STATIC_DATA, loadSiteData, buildDetail, staticReadOnly } from './staticData';

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

// ---- 读:静态站读 data.json,本地开发读后端 ----

export async function listCharacters(): Promise<Character[]> {
  if (STATIC_DATA) return (await loadSiteData()).characters;
  return apiFetch<Character[]>('/characters');
}

export async function getCharacter(id: number): Promise<CharacterDetail> {
  if (STATIC_DATA) return buildDetail(await loadSiteData(), id);
  return apiFetch<CharacterDetail>(`/characters/${id}`);
}

// ---- 写:仅本地编辑器(连后端)可用;静态站不支持 ----

export async function createCharacter(c: Partial<Character>): Promise<Character> {
  if (STATIC_DATA) staticReadOnly();
  return apiFetch<Character>('/characters', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(c),
  });
}

export async function updateCharacter(id: number, c: Partial<Character>): Promise<Character> {
  if (STATIC_DATA) staticReadOnly();
  return apiFetch<Character>(`/characters/${id}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(c),
  });
}

export async function deleteCharacter(id: number): Promise<void> {
  if (STATIC_DATA) staticReadOnly();
  return apiFetch<void>(`/characters/${id}`, { method: 'DELETE' });
}
