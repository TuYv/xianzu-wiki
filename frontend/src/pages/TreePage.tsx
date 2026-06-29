import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Character, Relationship } from '../types';
import { listCharacters } from '../api/characters';
import { listRelationships } from '../api/relationships';
import { FamilyTree } from '../components/FamilyTree';

const DEFAULT_DEPTH = 3; // 默认以当前人物为中心,上下各 3 代(spec §4.3)
const WHOLE_DEPTH = 999; // “查看整族”:不截断

export function TreePage() {
  const { id } = useParams<{ id: string }>();
  const focusId = Number(id);

  const [characters, setCharacters] = useState<Character[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [whole, setWhole] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([listCharacters(), listRelationships()])
      .then(([cs, rs]) => {
        if (!alive) return;
        setCharacters(cs);
        setRelationships(rs);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : '加载失败');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <div className="tree-page__msg">加载中…</div>;
  if (error) return <div className="tree-page__msg tree-page__msg--error">加载失败:{error}</div>;
  if (!Number.isFinite(focusId) || !characters.some((c) => c.id === focusId)) {
    return <div className="tree-page__msg">未找到该人物</div>;
  }

  return (
    <div className="tree-page">
      <div className="tree-page__bar">
        <button type="button" onClick={() => setWhole((w) => !w)}>
          {whole ? '回到以当前人物为中心' : '查看整族'}
        </button>
      </div>
      <div className="tree-page__canvas">
        <FamilyTree
          characters={characters}
          relationships={relationships}
          focusId={focusId}
          depth={whole ? WHOLE_DEPTH : DEFAULT_DEPTH}
        />
      </div>
    </div>
  );
}
