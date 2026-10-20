'use client'

import { Suspense, useState } from 'react'
import { ClientPagination } from '@/components/ui/pagination/client-pagination'
import { UrlPagination } from '@/components/ui/pagination/url-pagination'
import { PaginationFooter } from '@/components/ui/pagination/pagination-footer'
import { PaginationBar } from '@/components/ui/pagination/pagination-bar'
import { PageNav } from '@/components/ui/pagination/page-nav'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination/pagination'
import { AuthLink } from '@/components/ui/auth-link'
import { ContactLink } from '@/components/ui/contact-link'
import { OptionalLink } from '@/components/ui/optional-link'
import { BrandLogo } from '@/components/ui/brand-logo'
import { LanguageLabel } from '@/components/ui/language-label'
import type { LanguageT } from '@/lib/i18n/languages'
import { ShowcaseRow } from '../showcase-row'
import { ShowcaseSection } from '../showcase-section'

const LANGUAGES = Object.keys({
  pl: true,
  uk: true,
  ru: true,
} satisfies Record<LanguageT, true>) as LanguageT[]

const TOTAL_DOCS = 237
const BASE_URL = '/design'

export function NavigationSection() {
  const [page, setPage] = useState(3)
  const [pageSize, setPageSize] = useState(20)
  const [navPage, setNavPage] = useState(12)
  const totalPages = Math.ceil(TOTAL_DOCS / pageSize)

  return (
    <ShowcaseSection id="navigation">
      <ShowcaseRow
        title="ClientPagination"
        source="ui/pagination/client-pagination.tsx"
        className="flex-col items-stretch"
      >
        <ClientPagination
          totalDocs={TOTAL_DOCS}
          pageSize={pageSize}
          currentPage={Math.min(page, totalPages)}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </ShowcaseRow>
      <ShowcaseRow
        title="PageNav + PaginationBar"
        source="ui/pagination/page-nav.tsx, ui/pagination/pagination-bar.tsx"
        className="flex-col items-stretch"
      >
        <PageNav
          currentPage={navPage}
          totalPages={30}
          renderPage={(target, isInert, children) => (
            <button type="button" disabled={isInert} onClick={() => setNavPage(target)}>
              {children}
            </button>
          )}
        />
        <PaginationBar totalDocs={TOTAL_DOCS} limit={pageSize} onLimitChange={setPageSize} />
      </ShowcaseRow>
      <ShowcaseRow title="Prymitywy Pagination" source="ui/pagination/pagination.tsx">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious isDisabled />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink isActive>1</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink>2</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink isDisabled>…</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </ShowcaseRow>
      <ShowcaseRow
        title="Paginacja w URL (zmienia ?page)"
        source="ui/pagination/url-pagination.tsx, ui/pagination/pagination-footer.tsx"
        className="flex-col items-stretch"
      >
        <Suspense>
          <UrlPagination currentPage={1} totalPages={8} baseUrl={BASE_URL} />
          <PaginationFooter
            paginationMeta={{ currentPage: 1, totalPages: 8, totalDocs: 160, limit: 20 }}
            baseUrl={BASE_URL}
          />
        </Suspense>
      </ShowcaseRow>
      <ShowcaseRow
        title="Linki"
        source="ui/auth-link.tsx, ui/contact-link.tsx, ui/optional-link.tsx"
      >
        <AuthLink href="/zaloguj">AuthLink</AuthLink>
        <ContactLink type="email" value="biuro@example.com" />
        <ContactLink type="phone" value="+48 600 000 000" />
        <ContactLink type="phone" value={undefined} />
        <OptionalLink href={BASE_URL}>OptionalLink z href</OptionalLink>
        <OptionalLink href={null}>OptionalLink bez href</OptionalLink>
      </ShowcaseRow>
      <ShowcaseRow title="Marka i język" source="ui/brand-logo.tsx, ui/language-label.tsx">
        <BrandLogo height={40} />
        <BrandLogo height={24} />
        {LANGUAGES.map((language) => (
          <LanguageLabel key={language} language={language} />
        ))}
      </ShowcaseRow>
    </ShowcaseSection>
  )
}
