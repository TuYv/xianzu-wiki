import ReactMarkdown from 'react-markdown'

/**
 * 生平/备注的 Markdown 渲染。
 * 刻意只用 react-markdown 默认配置:不安装也不引入 rehype-raw,
 * 原始 HTML 自动被转义为文本,从渲染层阻断存储型 XSS(spec §6 / §13)。
 */
export function Markdown({ children }: { children: string }) {
  return <ReactMarkdown>{children}</ReactMarkdown>
}
