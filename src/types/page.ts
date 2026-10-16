export type ResolvedSearchParamsT = Record<string, string | string[] | undefined>

type SearchParamsT = Promise<ResolvedSearchParamsT>

export type PagePropsT = {
  searchParams: SearchParamsT
}

export type DynamicPagePropsT = {
  params: Promise<{ id: string }>
  searchParams: SearchParamsT
}
