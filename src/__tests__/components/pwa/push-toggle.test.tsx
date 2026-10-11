import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const keys = vi.hoisted(() => ({ publicKey: 'AQIDBA' as string | undefined }))
vi.mock('@/lib/env', () => ({
  get VAPID_PUBLIC_KEY() {
    return keys.publicKey
  },
}))

const subscribeThisDevice = vi.fn()
const unsubscribeThisDevice = vi.fn()
vi.mock('@/lib/push/push-client', () => ({
  isPushSupported: () => 'PushManager' in window,
  subscribeThisDevice: (...args: unknown[]) => subscribeThisDevice(...args),
  unsubscribeThisDevice: (...args: unknown[]) => unsubscribeThisDevice(...args),
}))

const platform = vi.hoisted(() => ({ current: 'standalone' as 'standalone' | 'ios' | 'browser' }))
vi.mock('@/lib/pwa/install-state', () => ({
  readPlatform: () => platform.current,
}))

const toastMessage = vi.fn()
vi.mock('@/lib/utils/toast', () => ({
  toastMessage: (...args: unknown[]) => toastMessage(...args),
}))

const { PushToggle } = await import('@/components/pwa/push-toggle')
const { usePushSubscriptionStore } = await import('@/stores/push-subscription-store')

const notification = { permission: 'default' as NotificationPermission }

beforeEach(() => {
  keys.publicKey = 'AQIDBA'
  platform.current = 'standalone'
  notification.permission = 'default'
  vi.stubGlobal('Notification', notification)
  vi.stubGlobal('PushManager', class {})
  usePushSubscriptionStore.setState({ subscribed: false })
  subscribeThisDevice.mockReset().mockResolvedValue({ success: true })
  unsubscribeThisDevice.mockReset().mockResolvedValue(undefined)
  toastMessage.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PushToggle', () => {
  it('turns notifications on for this device', async () => {
    render(<PushToggle />)

    fireEvent.click(screen.getByRole('button', { name: 'Włącz powiadomienia' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Wyłącz powiadomienia' })).toBeEnabled(),
    )
    expect(subscribeThisDevice).toHaveBeenCalledExactlyOnceWith('AQIDBA')
  })

  it('turns them off again', async () => {
    usePushSubscriptionStore.setState({ subscribed: true })
    render(<PushToggle />)

    fireEvent.click(screen.getByRole('button', { name: 'Wyłącz powiadomienia' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Włącz powiadomienia' })).toBeEnabled(),
    )
    expect(unsubscribeThisDevice).toHaveBeenCalledOnce()
  })

  it('points to the phone settings once the permission is refused', async () => {
    subscribeThisDevice.mockImplementation(async () => {
      notification.permission = 'denied'
      return 'denied'
    })
    render(<PushToggle />)

    fireEvent.click(screen.getByRole('button', { name: 'Włącz powiadomienia' }))

    expect(await screen.findByText(/Powiadomienia są zablokowane/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('keeps offering the switch when the prompt was only dismissed', async () => {
    subscribeThisDevice.mockResolvedValue('denied')
    render(<PushToggle />)

    fireEvent.click(screen.getByRole('button', { name: 'Włącz powiadomienia' }))

    await waitFor(() => expect(subscribeThisDevice).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Włącz powiadomienia' })).toBeEnabled(),
    )
  })

  it('stays off and says so when the subscribe throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    subscribeThisDevice.mockRejectedValue(new Error('push service down'))
    render(<PushToggle />)

    fireEvent.click(screen.getByRole('button', { name: 'Włącz powiadomienia' }))

    await waitFor(() =>
      expect(toastMessage).toHaveBeenCalledWith('Nie udało się zmienić powiadomień', 'error'),
    )
    expect(screen.getByRole('button', { name: 'Włącz powiadomienia' })).toBeEnabled()
  })

  it.each([
    ['without the public key', () => (keys.publicKey = undefined)],
    ['in Safari outside the home-screen app', () => (platform.current = 'ios')],
    [
      'before the open-time sync has read the device',
      () => usePushSubscriptionStore.setState({ subscribed: undefined }),
    ],
  ])('renders nothing %s', (_label, arrange) => {
    arrange()

    const { container } = render(<PushToggle />)

    expect(container).toBeEmptyDOMElement()
  })
})
