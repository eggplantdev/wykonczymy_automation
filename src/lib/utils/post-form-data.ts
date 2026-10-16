export async function postFormData<T>(
  route: string,
  formData: FormData,
  fallbackError: string,
): Promise<T> {
  const res = await fetch(route, { method: 'POST', body: formData })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: undefined }))
    throw new Error(body.error ?? `${fallbackError} (${res.status})`)
  }

  return res.json()
}
