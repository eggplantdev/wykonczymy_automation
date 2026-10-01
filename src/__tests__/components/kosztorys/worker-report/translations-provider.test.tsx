import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { useI18nContext, useTranslation } from '@/hooks/use-translation'
import { TranslationsProvider } from '@/components/kosztorys/worker-report/translations-provider'
import type { LanguageT } from '@/lib/i18n/languages'

const WORKER_ID = 7
const STORAGE_KEY = `worker-report-lang:${WORKER_ID}`

function Probe() {
  const { t } = useTranslation('report')
  const { setLocale } = useI18nContext()
  return (
    <>
      <p>{t('send')}</p>
      <button onClick={() => setLocale('ru')}>ru</button>
    </>
  )
}

const renderWith = (initialLocale: LanguageT) =>
  render(
    <TranslationsProvider initialLocale={initialLocale} workerId={WORKER_ID}>
      <Probe />
    </TranslationsProvider>,
  )

beforeEach(() => window.localStorage.clear())
afterEach(() => {
  document.documentElement.lang = ''
})

describe('TranslationsProvider', () => {
  it('without a provider the copy is Polish', () => {
    render(<Probe />)
    expect(screen.getByText('Wyślij')).toBeInTheDocument()
  })

  it('reads the worker’s language', () => {
    renderWith('uk')
    expect(screen.getByText('Надіслати')).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('uk')
  })

  it('a stored choice wins over the worker’s language', () => {
    window.localStorage.setItem(STORAGE_KEY, 'ru')
    renderWith('uk')
    expect(screen.getByText('Отправить')).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('ru')
  })

  it('a junk stored value falls back to the worker’s language', () => {
    window.localStorage.setItem(STORAGE_KEY, 'klingon')
    renderWith('uk')
    expect(screen.getByText('Надіслати')).toBeInTheDocument()
  })

  it('switching stores the choice for this worker and moves `lang`', () => {
    renderWith('pl')
    act(() => screen.getByText('ru').click())
    expect(screen.getByText('Отправить')).toBeInTheDocument()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('ru')
    expect(document.documentElement.lang).toBe('ru')
  })
})
