import { useMemo, useState, type FormEvent } from 'react';
import type { Character, Relationship, RelType, ParentRole } from '../types';
import { useAuth } from '../state/auth';
import { createRelationship, deleteRelationship } from '../api/relationships';

interface RelationshipPanelProps {
  characterId: number;
  characters: Character[];
  relationships: Relationship[];
  onChanged?: () => void;
}

const REL_TYPES: RelType[] = ['parent', 'spouse', 'master', 'sibling'];
const PARENT_ROLES: ParentRole[] = ['father', 'mother', 'adoptive', 'unknown'];

export function RelationshipPanel({
  characterId,
  characters,
  relationships,
  onChanged,
}: RelationshipPanelProps) {
  const { isAdmin } = useAuth();
  const [toId, setToId] = useState<number | ''>('');
  const [type, setType] = useState<RelType>('parent');
  const [parentRole, setParentRole] = useState<ParentRole>('father');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nameById = useMemo(() => {
    const m = new Map<number, string>();
    characters.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [characters]);

  if (!isAdmin) return null;

  const related = relationships.filter(
    (r) => r.from_id === characterId || r.to_id === characterId,
  );

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (toId === '') return;
    setError(null);
    setBusy(true);
    try {
      await createRelationship({
        from_id: characterId,
        to_id: Number(toId),
        type,
        parent_role: type === 'parent' ? parentRole : null,
        note: note.trim() || null,
      });
      setToId('');
      setNote('');
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'add failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    setError(null);
    setBusy(true);
    try {
      await deleteRelationship(id);
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'delete failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="relationship-panel">
      <ul>
        {related.map((r) => (
          <li key={r.id}>
            <span>
              {nameById.get(r.from_id) ?? r.from_id} → {nameById.get(r.to_id) ?? r.to_id} ({r.type}
              {r.parent_role ? `/${r.parent_role}` : ''})
            </span>
            <button
              type="button"
              aria-label={`delete-${r.id}`}
              onClick={() => handleDelete(r.id)}
              disabled={busy}
            >
              删除
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleAdd} aria-label="add-relationship">
        <select
          aria-label="to_id"
          value={toId}
          onChange={(e) => setToId(e.target.value === '' ? '' : Number(e.target.value))}
        >
          <option value="">选择对象</option>
          {characters
            .filter((c) => c.id !== characterId)
            .map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
        </select>
        <select aria-label="type" value={type} onChange={(e) => setType(e.target.value as RelType)}>
          {REL_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {type === 'parent' && (
          <select
            aria-label="parent_role"
            value={parentRole}
            onChange={(e) => setParentRole(e.target.value as ParentRole)}
          >
            {PARENT_ROLES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}
        <input aria-label="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="备注" />
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={busy || toId === ''}>添加关系</button>
      </form>
    </section>
  );
}
