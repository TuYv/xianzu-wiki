import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Character, CharacterDetail } from '../types'
import { getCharacter, listCharacters } from '../api/characters'
import { isSafeHttpUrl } from '../lib/safeUrl'
import { Markdown } from '../components/Markdown'
import { useAuth } from '../state/auth'
import { CharacterForm } from '../components/CharacterForm'
import { RelationshipPanel } from '../components/RelationshipPanel'

const GENDER_LABEL: Record<Character['gender'], string> = { male: '男', female: '女', unknown: '未知' }
const STATUS_LABEL: Record<Character['status'], string> = { alive: '在世', dead: '已故', unknown: '未知' }

/**
 * 公开人物详情页(spec §6 百科页)。
 * 数据来自公开接口 CharacterDetail(显式不含 notes):
 *  - 头像经 isSafeHttpUrl 校验后才渲染(拒 javascript: 伪协议)
 *  - 生平走 Markdown(默认转义,阻断存储型 XSS)
 *  - relationships 渲染为指向对方人物的跳转链接
 */
export function DetailPage() {
  const { id } = useParams<{ id: string }>()
  const { isAdmin } = useAuth()
  const [character, setCharacter] = useState<CharacterDetail | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const cid = Number(id)
    setCharacter(null)
    setError(null)
    getCharacter(cid)
      .then((c) => { if (!cancelled) setCharacter(c) })
      .catch(() => { if (!cancelled) setError('加载失败') })
    listCharacters()
      .then((cs) => { if (!cancelled) setCharacters(cs) })
      .catch(() => {
        /* 名称解析失败不阻塞详情渲染,链接降级为 #id */
      })
    return () => { cancelled = true }
  }, [id, reloadKey])

  // 编辑/关系变更后递增 reloadKey,触发上面的 effect 重新拉取详情与人物列表。
  const reload = () => setReloadKey((k) => k + 1)

  if (error) return <p role="alert">{error}</p>
  if (!character) return <p>加载中…</p>

  const selfId = character.id
  const safeAvatar = isSafeHttpUrl(character.avatar_url)
  const nameById: Record<number, string> = {}
  for (const c of characters) nameById[c.id] = c.name

  const attributes: Array<[string, string]> = [
    ['性别', GENDER_LABEL[character.gender]],
    ['状态', STATUS_LABEL[character.status]],
    ...(character.generation ? [['辈分', character.generation] as [string, string]] : []),
    ...(character.realm ? [['境界', character.realm] as [string, string]] : []),
    ...(character.affiliation ? [['势力', character.affiliation] as [string, string]] : []),
  ]

  return (
    <article className="detail">
      <header className="detail-header">
        {safeAvatar && (
          <img className="avatar" src={character.avatar_url ?? ''} alt={character.name} />
        )}
        <h1>{character.name}</h1>
        {character.aliases.length > 0 && (
          <p className="aliases">{character.aliases.join('、')}</p>
        )}
      </header>

      <dl className="attributes">
        {attributes.map(([k, v]) => (
          <div className="attr" key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      {character.bio && (
        <section className="bio">
          <Markdown>{character.bio}</Markdown>
        </section>
      )}

      <section className="relationships">
        <h2>关系</h2>
        {character.relationships.length === 0 ? (
          <p>暂无关系</p>
        ) : (
          <ul>
            {character.relationships.map((r) => {
              const otherId = r.from_id === selfId ? r.to_id : r.from_id
              const label = nameById[otherId] ?? `#${otherId}`
              return (
                <li key={r.id}>
                  <span className="rel-type">{r.type}</span>
                  {r.parent_role && <span className="rel-role">（{r.parent_role}）</span>}
                  <Link to={`/characters/${otherId}`}>{label}</Link>
                  {r.note && <span className="rel-note">{r.note}</span>}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <nav className="detail-nav">
        <Link to={`/tree/${selfId}`}>查看族谱</Link>
      </nav>

      {isAdmin && (
        <section className="detail-admin" aria-label="admin-edit">
          {editing ? (
            <CharacterForm
              initial={character}
              onSaved={() => {
                setEditing(false)
                reload()
              }}
            />
          ) : (
            <button type="button" onClick={() => setEditing(true)}>
              编辑
            </button>
          )}
          <RelationshipPanel
            characterId={selfId}
            characters={characters}
            relationships={character.relationships}
            onChanged={reload}
          />
        </section>
      )}
    </article>
  )
}
