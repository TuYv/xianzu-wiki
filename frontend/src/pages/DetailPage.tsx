import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { CharacterDetail } from '../types'
import { getCharacter, listCharacters } from '../api/characters'
import { isSafeHttpUrl } from '../lib/safeUrl'
import { Markdown } from '../components/Markdown'

/**
 * 公开人物详情页(spec §6 百科页)。
 * 数据来自公开接口 CharacterDetail(显式不含 notes):
 *  - 头像经 isSafeHttpUrl 校验后才渲染(拒 javascript: 伪协议)
 *  - 生平走 Markdown(默认转义,阻断存储型 XSS)
 *  - relationships 渲染为指向对方人物的跳转链接
 */
export function DetailPage() {
  const { id } = useParams<{ id: string }>()
  const [character, setCharacter] = useState<CharacterDetail | null>(null)
  const [names, setNames] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const cid = Number(id)
    setCharacter(null)
    setError(null)
    getCharacter(cid)
      .then(setCharacter)
      .catch(() => setError('加载失败'))
    listCharacters()
      .then((cs) => {
        const map: Record<number, string> = {}
        for (const c of cs) map[c.id] = c.name
        setNames(map)
      })
      .catch(() => {
        /* 名称解析失败不阻塞详情渲染,链接降级为 #id */
      })
  }, [id])

  if (error) return <p role="alert">{error}</p>
  if (!character) return <p>加载中…</p>

  const selfId = character.id
  const safeAvatar = isSafeHttpUrl(character.avatar_url)

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
        <dt>性别</dt>
        <dd>{character.gender}</dd>
        <dt>状态</dt>
        <dd>{character.status}</dd>
        {character.generation && (
          <>
            <dt>辈分</dt>
            <dd>{character.generation}</dd>
          </>
        )}
        {character.realm && (
          <>
            <dt>境界</dt>
            <dd>{character.realm}</dd>
          </>
        )}
        {character.affiliation && (
          <>
            <dt>势力</dt>
            <dd>{character.affiliation}</dd>
          </>
        )}
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
              const label = names[otherId] ?? `#${otherId}`
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
    </article>
  )
}
