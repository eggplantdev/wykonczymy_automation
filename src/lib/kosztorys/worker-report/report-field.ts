import { stageKey } from '@/lib/kosztorys/stage-keys'

// A stage id no etap can hold (serial ids start at 1), so the report rides the stage-qty field
// plumbing — the diff reports it like an etap edit — while every Σ etapów, which iterates the real
// etapy, never counts it into Pomiar.
export const REPORT_STAGE_ID = 0
export const REPORT_FIELD = stageKey(REPORT_STAGE_ID)
