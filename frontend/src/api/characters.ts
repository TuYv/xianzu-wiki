import { apiFetch } from './client';
import type { Character, CharacterDetail } from '../types';

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

export function listCharacters(): Promise<Character[]> {
  return apiFetch<Character[]>('/api/characters');
}

export function getCharacter(id: number): Promise<CharacterDetail> {
  return apiFetch<CharacterDetail>(`/api/characters/${id}`);
}

export function createCharacter(c: Partial<Character>): Promise<Character> {
  return apiFetch<Character>('/api/characters', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(c),
  });
}

export function updateCharacter(id: number, c: Partial<Character>): Promise<Character> {
  return apiFetch<Character>(`/api/characters/${id}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(c),
  });
}

export function deleteCharacter(id: number): Promise<void> {
  return apiFetch<void>(`/api/characters/${id}`, { method: 'DELETE' });
}
