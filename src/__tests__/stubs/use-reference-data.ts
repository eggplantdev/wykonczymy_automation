import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { orderSettingsFixture, referenceDataFor } from '@/__tests__/fixtures/reference-data'
import { isManagementRole } from '@/lib/auth/roles'

export const useReferenceData = () =>
  isManagementRole(authState.role)
    ? { ...referenceDataFor(authState.role), currentUserId: authState.userId }
    : null

export const useOrderSettings = () =>
  isManagementRole(authState.role) ? orderSettingsFixture : null
