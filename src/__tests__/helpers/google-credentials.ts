export const READER_CREDENTIAL = {
  client_email: 'kosztorys-sheets-reader@example.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nREADER\n-----END PRIVATE KEY-----\n',
}

export const WRITER_CREDENTIAL = {
  client_email: 'kosztorys-sheets@example.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nWRITER\n-----END PRIVATE KEY-----\n',
}

// `writer: false` reproduces every environment but production — the case where a write must refuse.
export function setGoogleCredentialEnv({ writer = true }: { writer?: boolean } = {}) {
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(READER_CREDENTIAL)
  if (writer) process.env.GOOGLE_SERVICE_ACCOUNT_WRITE_JSON = JSON.stringify(WRITER_CREDENTIAL)
  else delete process.env.GOOGLE_SERVICE_ACCOUNT_WRITE_JSON
}
