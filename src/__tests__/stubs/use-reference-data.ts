import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { orderSettingsFixture, referenceDataFor } from '@/__tests__/helpers/reference-data'
import { isManagementRole } from '@/lib/auth/roles'

// Reads the get-current-user-jwt stub's `authState`, like the shell: no reference data for an EMPLOYEE.
export const useReferenceData = () =>
  isManagementRole(authState.role)
    ? { ...referenceDataFor(authState.role), currentUserId: authState.userId }
    : null

export const useOrderSettings = () =>
  isManagementRole(authState.role) ? orderSettingsFixture : null
