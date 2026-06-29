import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CharacterCard } from './CharacterCard';
import type { Character } from '../types';

const base: Character = {
  id: 7,
  name: '萧寒',
  aliases: ['寒少', '冷面君'],
  gender: 'male',
  generation: '三代',
  realm: '金丹',
  affiliation: '萧家',
  status: 'alive',
  avatar_url: null,
  bio: null,
};

function renderCard(c: Character) {
  return render(
    <MemoryRouter>
      <CharacterCard character={c} />
    </MemoryRouter>,
  );
}

describe('CharacterCard', () => {
  it('renders name, aliases and meta', () => {
    renderCard(base);
    expect(screen.getByText('萧寒')).toBeInTheDocument();
    expect(screen.getByText(/寒少/)).toBeInTheDocument();
    expect(screen.getByText(/金丹/)).toBeInTheDocument();
  });

  it('links to the detail page', () => {
    renderCard(base);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/characters/7');
  });

  it('renders avatar img only for a safe http(s) url', () => {
    const { rerender } = renderCard({ ...base, avatar_url: 'http://img/a.png' });
    expect(screen.getByRole('img')).toHaveAttribute('src', 'http://img/a.png');

    rerender(
      <MemoryRouter>
        <CharacterCard character={{ ...base, avatar_url: 'javascript:alert(1)' }} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
