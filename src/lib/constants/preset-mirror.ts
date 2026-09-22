/**
 * The szablon workbench mirrors its tree into `kosztorys_presets.payload` after EVERY successful
 * mutation, so without a throttle pasting fifty cells is fifty rewrites of the whole jsonb.
 */
export const PRESET_MIRROR_THROTTLE_SECONDS = 10

/**
 * A throttle loses the last change by definition — nothing follows it to carry it in. Hence a
 * second clock, on the client. It must be LONGER than the throttle: shorter, and a natural pause in
 * typing would outrun the throttle and put us back to one mirror per change.
 */
export const PRESET_MIRROR_IDLE_FLUSH_MS = 15_000
