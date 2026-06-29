import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { DetailPage } from './DetailPage'
import { getCharacter, listCharacters } from '../api/characters'
import type { CharacterDetail, Character } from '../types'

vi.mock('../api/characters', () => ({
  getCharacter: vi.fn(),
  listCharacters: vi.fn(),
}))

const mockGet = vi.mocked(getCharacter)
const mockList = vi.mocked(listCharacters)

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true }

function renderAt(id: number) {
  return render(
    <MemoryRouter initialEntries={[`/characters/${id}`]} future={routerFuture}>
      <Routes>
        <Route path="/characters/:id" element={<DetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function makeDetail(over: Partial<CharacterDetail>): CharacterDetail {
  return {
    id: 1,
    name: '叶凡',
    aliases: [],
    gender: 'male',
    generation: null,
    realm: null,
    affiliation: null,
    status: 'alive',
    avatar_url: null,
    bio: null,
    relationships: [],
    ...over,
  }
}

const others: Character[] = [
  { id: 1, name: '叶凡', aliases: [], gender: 'male', generation: null, realm: null, affiliation: null, status: 'alive', avatar_url: null, bio: null },
  { id: 2, name: '段德', aliases: [], gender: 'male', generation: null, realm: null, affiliation: null, status: 'alive', avatar_url: null, bio: null },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DetailPage', () => {
  it('rejects javascript: avatar url (renders no img)', async () => {
    mockGet.mockResolvedValue(makeDetail({ avatar_url: 'javascript:alert(1)' }))
    mockList.mockResolvedValue([])
    const { container } = renderAt(1)
    await screen.findByRole('heading', { name: '叶凡' })
    expect(container.querySelector('img')).toBeNull()
  })

  it('renders safe https avatar and resolves relationship link to other character', async () => {
    mockGet.mockResolvedValue(
      makeDetail({
        avatar_url: 'https://img.example.com/a.png',
        bio: '# 生平\n\n横推万古',
        relationships: [
          { id: 10, from_id: 1, to_id: 2, type: 'master', parent_role: null, note: null },
        ],
      }),
    )
    mockList.mockResolvedValue(others)
    renderAt(1)

    // 关系链接:指向另一方人物,文本是其姓名
    const link = await screen.findByRole('link', { name: '段德' })
    expect(link.getAttribute('href')).toBe('/characters/2')

    // 安全头像被渲染
    const img = screen.getByRole('img')
    expect(img.getAttribute('src')).toBe('https://img.example.com/a.png')

    // Markdown 生平被渲染为元素
    expect(screen.getByRole('heading', { name: '生平' })).toBeTruthy()
  })

  it('does not render notes (public detail has no notes field)', async () => {
    mockGet.mockResolvedValue(makeDetail({ bio: '正文' }))
    mockList.mockResolvedValue([])
    const { container } = renderAt(1)
    await screen.findByRole('heading', { name: '叶凡' })
    expect(container.textContent).not.toContain('notes')
  })
})
