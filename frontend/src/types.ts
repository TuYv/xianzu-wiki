export type Gender = 'male' | 'female' | 'unknown';
export type Status = 'alive' | 'dead' | 'unknown';
export type RelType = 'parent' | 'spouse' | 'master' | 'sibling';
export type ParentRole = 'father' | 'mother' | 'adoptive' | 'unknown';

export interface Character {
  id: number;
  name: string;
  aliases: string[];
  gender: Gender;
  generation: string | null;
  realm: string | null;
  affiliation: string | null;
  status: Status;
  avatar_url: string | null;
  bio: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Relationship {
  id: number;
  from_id: number;
  to_id: number;
  type: RelType;
  parent_role: ParentRole | null;
  note: string | null;
}

export interface CharacterDetail extends Character {
  relationships: Relationship[];
}

export interface RelationshipImport {
  from_name: string;
  to_name: string;
  type: RelType;
  parent_role?: ParentRole | null;
  note?: string | null;
}

export interface ImportPayload {
  characters: Partial<Character>[];
  relationships: RelationshipImport[];
}

export interface ExportPayload {
  characters: Character[];
  relationships: Relationship[];
}
