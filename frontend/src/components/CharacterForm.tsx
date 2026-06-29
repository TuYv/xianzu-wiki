import { useState, type FormEvent } from 'react';
import type { Character, Gender, Status } from '../types';
import { useAuth } from '../state/auth';
import { createCharacter, updateCharacter } from '../api/characters';

interface CharacterFormProps {
  initial?: Character | null;
  onSaved?: (character: Character) => void;
}

const GENDERS: Gender[] = ['male', 'female', 'unknown'];
const STATUSES: Status[] = ['alive', 'dead', 'unknown'];

export function CharacterForm({ initial = null, onSaved }: CharacterFormProps) {
  const { isAdmin } = useAuth();
  const [name, setName] = useState(initial?.name ?? '');
  const [aliases, setAliases] = useState((initial?.aliases ?? []).join(', '));
  const [gender, setGender] = useState<Gender>(initial?.gender ?? 'unknown');
  const [generation, setGeneration] = useState(initial?.generation ?? '');
  const [realm, setRealm] = useState(initial?.realm ?? '');
  const [affiliation, setAffiliation] = useState(initial?.affiliation ?? '');
  const [status, setStatus] = useState<Status>(initial?.status ?? 'alive');
  const [avatarUrl, setAvatarUrl] = useState(initial?.avatar_url ?? '');
  const [bio, setBio] = useState(initial?.bio ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isAdmin) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const payload: Partial<Character> = {
      name: name.trim(),
      aliases: aliases.split(',').map((a) => a.trim()).filter(Boolean),
      gender,
      generation: generation.trim() || null,
      realm: realm.trim() || null,
      affiliation: affiliation.trim() || null,
      status,
      avatar_url: avatarUrl.trim() || null,
      bio: bio.trim() || null,
      notes: notes.trim() || null,
    };
    try {
      const saved = initial?.id
        ? await updateCharacter(initial.id, payload)
        : await createCharacter(payload);
      onSaved?.(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="character-form">
      <label>
        姓名
        <input aria-label="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        别名
        <input
          aria-label="aliases"
          value={aliases}
          onChange={(e) => setAliases(e.target.value)}
          placeholder="逗号分隔"
        />
      </label>
      <label>
        性别
        <select aria-label="gender" value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
          {GENDERS.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </label>
      <label>
        辈分
        <input aria-label="generation" value={generation} onChange={(e) => setGeneration(e.target.value)} />
      </label>
      <label>
        境界
        <input aria-label="realm" value={realm} onChange={(e) => setRealm(e.target.value)} />
      </label>
      <label>
        所属
        <input aria-label="affiliation" value={affiliation} onChange={(e) => setAffiliation(e.target.value)} />
      </label>
      <label>
        状态
        <select aria-label="status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>
      <label>
        头像 URL
        <input aria-label="avatar_url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
      </label>
      <label>
        生平
        <textarea aria-label="bio" value={bio} onChange={(e) => setBio(e.target.value)} />
      </label>
      <label>
        备注
        <textarea aria-label="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={saving}>{initial?.id ? '保存' : '新建'}</button>
    </form>
  );
}
