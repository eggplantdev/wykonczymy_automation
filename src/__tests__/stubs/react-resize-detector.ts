// dsg sizes its virtualised rows off the measured grid; jsdom measures everything as 0×0, which
// renders the header and nothing under it.
export const useResizeDetector = () => ({ width: 1600, height: 800 })
