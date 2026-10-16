export type TemplateSnapshotSectionT = {
  name: string
  color: string | null
  catalogueItemIds: number[]
}

export type TemplateSnapshotPayloadT = {
  sections: TemplateSnapshotSectionT[]
}

export const TEMPLATE_SNAPSHOT_SCHEMA_VERSION = 1 as const
