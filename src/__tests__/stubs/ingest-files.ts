// Image compression never settles under jsdom, so a picked file would never reach a row.
export const ingestFiles = async (picked: File[]) => ({ processed: picked, blocked: [] })
