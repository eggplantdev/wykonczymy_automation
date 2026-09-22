import type { CollectionConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'

const SOURCE_OPTIONS = [
  { label: { en: 'Facebook Lead Ads', pl: 'Facebook Lead Ads' }, value: 'facebook_lead_ads' },
  { label: { en: 'Website form', pl: 'Formularz WWW' }, value: 'website_form' },
  { label: { en: 'Landing page form', pl: 'Strona docelowa' }, value: 'landing_form' },
] as const

// The landing's form asks for these; Facebook Lead Ads cannot carry them, so on such a lead the
// field would be a permanently empty row in /admin.
const hideForFacebook = {
  condition: (data: { source?: string }) => data?.source !== 'facebook_lead_ads',
}

const CONTACT_STATUS_OPTIONS = [
  { label: { en: 'Pending', pl: 'Oczekuje' }, value: 'new' },
  { label: { en: 'Contacted', pl: 'Skontaktowano' }, value: 'contacted' },
] as const

// Shared by notifyStatus + autoReplyStatus — outcome of an async side effect per lead.
const DELIVERY_STATUS_OPTIONS = [
  { label: { en: 'Pending', pl: 'Oczekuje' }, value: 'pending' },
  { label: { en: 'Sent', pl: 'Wysłano' }, value: 'sent' },
  { label: { en: 'Failed', pl: 'Błąd' }, value: 'failed' },
  { label: { en: 'Skipped', pl: 'Pominięto' }, value: 'skipped' },
] as const

export const Leads: CollectionConfig = {
  slug: 'leads',
  labels: {
    singular: { en: 'Submission', pl: 'Zgłoszenie' },
    plural: { en: 'Submissions', pl: 'Zgłoszenia' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'phone', 'submittedAt', 'contactStatus'],
    group: { en: 'Leads', pl: 'Zgłoszenia' },
  },
  hooks: {
    afterChange: [makeRevalidateAfterChange('leads')],
    afterDelete: [makeRevalidateAfterDelete('leads')],
  },
  access: {
    read: isAdminOrOwnerOrManager,
    create: isAdminOrOwnerOrManager,
    update: isAdminOrOwnerOrManager,
    delete: isAdminOrOwner,
  },
  fields: [
    {
      name: 'source',
      type: 'select',
      required: true,
      label: { en: 'Source', pl: 'Źródło' },
      options: [...SOURCE_OPTIONS],
    },
    {
      name: 'email',
      type: 'email',
      index: true,
      label: { en: 'Email', pl: 'Email' },
    },
    {
      name: 'name',
      type: 'text',
      label: { en: 'Name', pl: 'Imię i nazwisko' },
    },
    {
      name: 'phone',
      type: 'text',
      label: { en: 'Phone', pl: 'Telefon' },
    },
    {
      name: 'address',
      type: 'text',
      label: { en: 'Address', pl: 'Adres' },
      admin: hideForFacebook,
    },
    {
      name: 'scope',
      type: 'text',
      label: { en: 'Scope', pl: 'Zakres prac' },
      admin: hideForFacebook,
    },
    // Text, not a number: the form invites a range („30–60 m²"), which no numeric column holds.
    {
      name: 'area',
      type: 'text',
      label: { en: 'Area', pl: 'Metraż' },
      admin: hideForFacebook,
    },
    {
      name: 'assets',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      label: { en: 'Photos and files', pl: 'Zdjęcia i pliki' },
      admin: hideForFacebook,
    },
    // Written only by the promotion action — the pointer back to what this zgłoszenie became.
    {
      name: 'investment',
      type: 'relationship',
      relationTo: 'investments',
      hasMany: false,
      label: { en: 'Investment', pl: 'Inwestycja' },
      admin: { readOnly: true },
    },
    {
      name: 'rawData',
      type: 'json',
      label: { en: 'Raw data', pl: 'Surowe dane' },
      admin: {
        description: {
          en: 'Full field_data as submitted — ground truth, never lossy',
          pl: 'Pełne field_data tak jak przesłane — źródło prawdy',
        },
      },
    },
    {
      name: 'formQuestions',
      type: 'json',
      label: { en: 'Form questions', pl: 'Pytania formularza' },
      admin: {
        description: {
          en: 'key→label map from the form definition, so raw answers render as real questions',
          pl: 'mapa klucz→etykieta z definicji formularza — by odpowiedzi renderować jako prawdziwe pytania',
        },
      },
    },
    {
      name: 'externalId',
      type: 'text',
      label: { en: 'External ID', pl: 'ID zewnętrzne' },
      admin: {
        description: {
          en: 'Source lead id (e.g. Meta leadgen_id) — unique per source',
          pl: 'ID zgłoszenia w źródle (np. Meta leadgen_id) — unikalne w obrębie źródła',
        },
      },
    },
    {
      name: 'formId',
      type: 'text',
      label: { en: 'Form ID', pl: 'ID formularza' },
    },
    {
      name: 'formName',
      type: 'text',
      label: { en: 'Form name', pl: 'Nazwa formularza' },
    },
    {
      name: 'submittedAt',
      type: 'date',
      label: { en: 'Submitted at', pl: 'Data zgłoszenia' },
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
          displayFormat: 'dd.MM.yyyy HH:mm',
        },
      },
    },
    {
      name: 'contactStatus',
      type: 'select',
      required: true,
      defaultValue: 'new',
      label: { en: 'Contact status', pl: 'Status kontaktu' },
      options: [...CONTACT_STATUS_OPTIONS],
    },
    {
      name: 'notifyStatus',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      label: { en: 'Notification status', pl: 'Status powiadomienia' },
      options: [...DELIVERY_STATUS_OPTIONS],
      admin: { readOnly: true },
    },
    {
      name: 'autoReplyStatus',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      label: { en: 'Auto-reply status', pl: 'Status auto-odpowiedzi' },
      options: [...DELIVERY_STATUS_OPTIONS],
      admin: { readOnly: true },
    },
  ],
}
