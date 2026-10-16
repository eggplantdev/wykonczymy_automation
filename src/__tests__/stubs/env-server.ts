export const serverEnv = new Proxy(
  {},
  {
    get: (_target, key: string) => process.env[key],
  },
) as Record<string, string | undefined>
