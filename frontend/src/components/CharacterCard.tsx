import { Link } from 'react-router-dom';
import type { Character } from '../types';
import { isSafeHttpUrl } from '../lib/safeUrl';

const STATUS_LABEL: Record<Character['status'], string> = {
  alive: '在世',
  dead: '已故',
  unknown: '未知',
};

export function CharacterCard({ character }: { character: Character }) {
  const meta = [character.realm, character.affiliation].filter(Boolean).join(' / ');
  return (
    <Link
      to={`/characters/${character.id}`}
      className="character-card"
      data-testid="character-card"
    >
      {isSafeHttpUrl(character.avatar_url) ? (
        <img
          src={character.avatar_url ?? undefined}
          alt={character.name}
          className="character-card__avatar"
        />
      ) : (
        <div className="character-card__avatar character-card__avatar--placeholder" aria-hidden="true" />
      )}
      <div className="character-card__body">
        <h3 className="character-card__name">{character.name}</h3>
        {character.aliases.length > 0 && (
          <p className="character-card__aliases">{character.aliases.join(' · ')}</p>
        )}
        {meta && <p className="character-card__meta">{meta}</p>}
        <span className={`character-card__status character-card__status--${character.status}`}>
          {STATUS_LABEL[character.status]}
        </span>
      </div>
    </Link>
  );
}
