// A szablon version stores „which prace, in what layout” — katalog ids per section, in order, and
// nothing a katalog entry owns (opis, j.m., cena, stawki, tłumaczenia). A restore therefore renders
// today's katalog wording, and a ref to a since-deleted katalog entry is skipped.
export type TemplateSnapshotSectionT = {
  name: string
  color: string | null
  catalogueItemIds: number[]
}

export type TemplateSnapshotPayloadT = {
  sections: TemplateSnapshotSectionT[]
}

export const TEMPLATE_SNAPSHOT_SCHEMA_VERSION = 1 as const
