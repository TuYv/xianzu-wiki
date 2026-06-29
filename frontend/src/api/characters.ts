import { apiFetch } from './client';
import type { Character, CharacterDetail } from '../types';

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

export function listCharacters(): Promise<Character[]> {
  return apiFetch<Character[]>('/characters');
}

export function getCharacter(id: number): Promise<CharacterDetail> {
  return apiFetch<CharacterDetail>(`/characters/${id}`);
}

export function createCharacter(c: Partial<Character>): Promise<Character> {
  return apiFetch<Character>('/characters', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(c),
  });
}

export function updateCharacter(id: number, c: Partial<Character>): Promise<Character> {
  return apiFetch<Character>(`/characters/${id}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(c),
  });
}

export function deleteCharacter(id: number): Promise<void> {
  return apiFetch<void>(`/characters/${id}`, { method: 'DELETE' });
}
