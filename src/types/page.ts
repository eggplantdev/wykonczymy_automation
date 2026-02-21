type SearchParamsT = Promise<Record<string, string | string[] | undefined>>

export type PagePropsT = {
  readonly searchParams: SearchParamsT
}

export type DynamicPagePropsT = {
  readonly params: Promise<{ id: string }>
  readonly searchParams: SearchParamsT
}
