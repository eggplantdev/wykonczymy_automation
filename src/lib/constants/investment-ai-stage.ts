// No `server-only` — the collection reads it inside the Payload CLI graph.
export const INVESTMENT_AI_STAGES = [
  'ready_for_analysis',
  'analyzed',
  'review_done',
  'knowledge_extracted',
  'new_information',
] as const

export type InvestmentAiStageT = (typeof INVESTMENT_AI_STAGES)[number]

export const isInvestmentAiStage = (value: unknown): value is InvestmentAiStageT =>
  (INVESTMENT_AI_STAGES as readonly unknown[]).includes(value)

export const INVESTMENT_AI_STAGE_LABELS: Record<
  InvestmentAiStageT,
  { pl: string; en: string; description: string }
> = {
  ready_for_analysis: {
    pl: 'Gotowa do analizy',
    en: 'Ready for analysis',
    description:
      'Oznacz, gdy dodasz wszystkie informacje o inwestycji — treść wiadomości, ustalenia, zakres prac, zdjęcia, plan itp.',
  },
  analyzed: {
    pl: 'Przeanalizowana',
    en: 'Analyzed',
    description: 'AI przygotowało szkic kosztorysu i jest on wgrany — czeka na recenzję.',
  },
  review_done: {
    pl: 'Recenzja zakończona',
    en: 'Review done',
    description:
      'Oznacz, gdy przejrzysz szkic od AI i przy każdej poprawionej pozycji wpiszesz „Powód zmiany”.',
  },
  knowledge_extracted: {
    pl: 'Wiedza wyekstraktowana',
    en: 'Knowledge extracted',
    description:
      'Oznacz, gdy powody zmian z tej inwestycji trafią do Manuala i Komentarzy do prac.',
  },
  new_information: {
    pl: 'Nowe informacje',
    en: 'New information',
    description:
      'Oznacz, gdy po analizie dojdą nowe informacje — plan, projekt, kolejna wiadomość. Dodaj je do inwestycji, a AI przeanalizuje ją ponownie.',
  },
}

// No stored stage — where every investment starts.
export const AI_STAGE_GATHERING = {
  pl: 'Uzupełnianie informacji',
  description:
    'Zbierasz informacje o inwestycji — treść wiadomości, ustalenia, zakres prac, zdjęcia, plan. Gdy masz komplet, oznacz „Gotowa do analizy”.',
}

// The listing's one „Analiza AI” step. Ordered — the sort reads the index.
export const AI_PROGRESS_STEPS = ['none', ...INVESTMENT_AI_STAGES] as const

export type AiProgressStepT = (typeof AI_PROGRESS_STEPS)[number]

export const AI_PROGRESS_LABELS: Record<AiProgressStepT, string> = {
  none: AI_STAGE_GATHERING.pl,
  ready_for_analysis: INVESTMENT_AI_STAGE_LABELS.ready_for_analysis.pl,
  analyzed: INVESTMENT_AI_STAGE_LABELS.analyzed.pl,
  review_done: INVESTMENT_AI_STAGE_LABELS.review_done.pl,
  knowledge_extracted: INVESTMENT_AI_STAGE_LABELS.knowledge_extracted.pl,
  new_information: INVESTMENT_AI_STAGE_LABELS.new_information.pl,
}
