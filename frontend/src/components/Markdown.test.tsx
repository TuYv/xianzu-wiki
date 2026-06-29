import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Markdown } from './Markdown'

describe('Markdown', () => {
  it('renders basic markdown to html elements', () => {
    const { container } = render(<Markdown>{'# 标题\n\n正文段落'}</Markdown>)
    expect(container.querySelector('h1')?.textContent).toBe('标题')
    expect(container.querySelector('p')?.textContent).toContain('正文段落')
  })

  it('escapes raw HTML instead of injecting it (no rehype-raw)', () => {
    const { container } = render(
      <Markdown>{'<script>alert(1)</script><b>x</b><img src=x onerror=alert(2)>'}</Markdown>,
    )
    // 关键安全断言:原始 HTML 不得变成真实 DOM 节点
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    // 而是作为纯文本转义展示
    expect(container.textContent).toContain('<script>alert(1)</script>')
  })
})
