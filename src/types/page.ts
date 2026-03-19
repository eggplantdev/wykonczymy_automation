type SearchParamsT = Promise<Record<string, string | string[] | undefined>>

export type PagePropsT = {
  searchParams: SearchParamsT
}

export type DynamicPagePropsT = {
  params: Promise<{ id: string }>
  searchParams: SearchParamsT
}
