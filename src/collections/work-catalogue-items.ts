import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'

export const WorkCatalogueItems: CollectionConfig = {
  slug: 'work-catalogue-items',
  labels: {
    singular: { en: 'Catalogue Work Item', pl: 'Pozycja katalogu prac' },
    plural: { en: 'Catalogue Work Items', pl: 'Katalog prac' },
  },
  admin: {
    useAsTitle: 'description',
    defaultColumns: ['description', 'category', 'unit', 'clientPrice'],
    group: { en: 'Kosztorys', pl: 'Kosztorys' },
  },
  hooks: {
    afterChange: [makeRevalidateAfterChange('workCatalogue')],
    afterDelete: [makeRevalidateAfterDelete('workCatalogue')],
  },
  access: {
    read: isAdminOrOwnerOrManager,
    create: isAdminOrOwnerOrManager,
    update: isAdminOrOwnerOrManager,
    delete: isAdminOrOwnerOrManager,
  },
  fields: [
    {
      name: 'description',
      type: 'text',
      required: true,
      label: { en: 'Description', pl: 'Opis pracy' },
    },
    {
      name: 'category',
      type: 'text',
      label: { en: 'Category', pl: 'Kategoria' },
    },
    {
      name: 'unit',
      type: 'text',
      required: true,
      label: { en: 'Unit', pl: 'j.m.' },
    },
    {
      name: 'clientPrice',
      type: 'number',
      required: true,
      min: 0,
      label: { en: 'Client price', pl: 'Cena j.m.' },
    },
    {
      // Absent = „auto": the katalog holds no stawka and the praca prices off the target
      // investment's global współczynnik once it lands in a rozpiska.
      name: 'wToolsRate',
      type: 'number',
      min: 0,
      label: { en: 'Rate with tools', pl: 'Stawka z narzędziami (podwykonawca)' },
    },
    {
      name: 'ownToolsRate',
      type: 'number',
      min: 0,
      label: { en: 'Rate without tools', pl: 'Stawka bez narzędzi (pracownik)' },
    },
    {
      // The multiplier twin of the two rates above (EX-865): the katalog names a RATIO against the
      // cena j.m. instead of a frozen złotówka, so the praca reprices itself in whichever rozpiska
      // it lands in. At most one of a plane's pair is ever non-null.
      name: 'wToolsRateCoeff',
      type: 'number',
      min: 0,
      label: { en: 'Multiplier with tools', pl: 'Mnożnik z narzędziami (podwykonawca)' },
    },
    {
      name: 'ownToolsRateCoeff',
      type: 'number',
      min: 0,
      label: { en: 'Multiplier without tools', pl: 'Mnożnik bez narzędzi (pracownik)' },
    },
    {
      // Derived from opis + j.m. by `catalogueKey`, never typed. Hidden because a hand-edited key
      // would decouple the UNIQUE index from the identity it is supposed to enforce.
      name: 'matchKey',
      type: 'text',
      required: true,
      // Unique index lives in the migration too (20260901_0) — single-column, so the two agree.
      unique: true,
      admin: { hidden: true },
    },
  ],
}
