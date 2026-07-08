import { describe, it, expect } from 'vitest'
import { renderBrandedEmail } from '@/lib/leads/email-template'

// Synthetic inputs only — this pins the template MECHANICS (logo, HTML escaping,
// newline handling), so it never breaks when the actual email copy changes.
const render = (overrides?: Partial<Parameters<typeof renderBrandedEmail>[0]>) =>
  renderBrandedEmail({
    logoUrl: 'https://example.com/logo.png',
    heading: 'Heading',
    paragraphs: ['one'],
    ...overrides,
  })

describe('renderBrandedEmail', () => {
  it('embeds the logo by the given absolute URL', () => {
    expect(render()).toContain('<img src="https://example.com/logo.png"')
  })

  it('renders the WYKOŃCZYMY wordmark alongside the logo', () => {
    expect(render()).toContain('WYKOŃCZYMY')
  })

  it('escapes HTML in heading and paragraphs', () => {
    const html = render({ heading: '<b>x</b>', paragraphs: ['a & <script>'] })
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
    expect(html).toContain('a &amp; &lt;script&gt;')
    expect(html).not.toContain('<script>')
  })

  it('renders a newline in a paragraph as <br />', () => {
    expect(render({ paragraphs: ['line1\nline2'] })).toContain('line1<br />line2')
  })

  it('renders each paragraph in its own <p> block', () => {
    const html = render({ paragraphs: ['first', 'second'] })
    expect(html.match(/<p /g)?.length).toBeGreaterThanOrEqual(2)
    expect(html).toContain('first')
    expect(html).toContain('second')
  })

  it('omits the footer block when no footer is given', () => {
    expect(render({ footer: undefined })).not.toContain('<hr')
    expect(render({ footer: 'small print' })).toContain('small print')
  })
})
