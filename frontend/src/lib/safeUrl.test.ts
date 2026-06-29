import { describe, it, expect } from 'vitest'
import { isSafeHttpUrl } from './safeUrl'

describe('isSafeHttpUrl', () => {
  it('accepts http and https absolute urls', () => {
    expect(isSafeHttpUrl('http://img.example.com/a.png')).toBe(true)
    expect(isSafeHttpUrl('https://img.example.com/a.png')).toBe(true)
  })

  it('rejects javascript: pseudo protocol', () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false)
    // 大小写/空白绕过尝试
    expect(isSafeHttpUrl('  JavaScript:alert(1)')).toBe(false)
  })

  it('rejects data: and other non-http schemes', () => {
    expect(isSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isSafeHttpUrl('ftp://example.com/x')).toBe(false)
  })

  it('rejects null, undefined, empty and relative paths', () => {
    expect(isSafeHttpUrl(null)).toBe(false)
    expect(isSafeHttpUrl(undefined)).toBe(false)
    expect(isSafeHttpUrl('')).toBe(false)
    expect(isSafeHttpUrl('/local/a.png')).toBe(false)
  })
})
