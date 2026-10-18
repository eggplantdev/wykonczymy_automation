import { authState } from '@/__tests__/stubs/get-current-user-jwt'

// Reads the get-current-user-jwt stub's `authState`, so one assignment steers the session on both sides.
export const useCurrentUser = () => ({
  id: authState.userId,
  email: 'o@example.test',
  name: 'Testowy',
  role: authState.role,
})
