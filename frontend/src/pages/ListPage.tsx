import { useEffect, useMemo, useState } from 'react';
import type { Character, Status } from '../types';
import { listCharacters } from '../api/characters';
import { CharacterCard } from '../components/CharacterCard';

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'alive', label: '在世' },
  { value: 'dead', label: '已故' },
  { value: 'unknown', label: '未知' },
];

export function filterCharacters(
  characters: Character[],
  keyword: string,
  affiliation: string,
  realm: string,
  status: string,
): Character[] {
  const kw = keyword.trim().toLowerCase();
  return characters.filter((c) => {
    if (kw) {
      const haystack = [c.name, ...c.aliases].join(' ').toLowerCase();
      if (!haystack.includes(kw)) return false;
    }
    if (affiliation && c.affiliation !== affiliation) return false;
    if (realm && c.realm !== realm) return false;
    if (status && c.status !== status) return false;
    return true;
  });
}

function uniqueSorted(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))].sort();
}

export function ListPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [realm, setRealm] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    let active = true;
    listCharacters()
      .then((data) => {
        if (active) setCharacters(data);
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      active = false;
    };
  }, []);

  const affiliations = useMemo(() => uniqueSorted(characters.map((c) => c.affiliation)), [characters]);
  const realms = useMemo(() => uniqueSorted(characters.map((c) => c.realm)), [characters]);

  const visible = useMemo(
    () => filterCharacters(characters, keyword, affiliation, realm, status),
    [characters, keyword, affiliation, realm, status],
  );

  return (
    <div className="list-page">
      <div className="list-page__filters">
        <input
          type="search"
          placeholder="搜索姓名或别名"
          aria-label="搜索姓名或别名"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <select aria-label="势力" value={affiliation} onChange={(e) => setAffiliation(e.target.value)}>
          <option value="">全部势力</option>
          {affiliations.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select aria-label="境界" value={realm} onChange={(e) => setRealm(e.target.value)}>
          <option value="">全部境界</option>
          {realms.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select aria-label="状态" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">全部状态</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="list-page__error">加载失败:{error}</p>}

      <p className="list-page__count">共 {visible.length} 人</p>

      <div className="list-page__grid">
        {visible.map((c) => (
          <CharacterCard key={c.id} character={c} />
        ))}
      </div>
    </div>
  );
}
