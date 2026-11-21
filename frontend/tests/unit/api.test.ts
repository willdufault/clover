import { UserManager } from 'oidc-client-ts'
import { api, handleRedirect } from '../../src/api'

const userKey = `oidc.user:${import.meta.env.VITE_COGNITO_URL}:${import.meta.env.VITE_COGNITO_CLIENT_ID}`

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

test('api sends the access token and throws the server error message', async () => {
  localStorage.setItem(
    userKey,
    JSON.stringify({ access_token: 'abc', token_type: 'Bearer', profile: { sub: 'u' }, expires_at: 9999999999 }),
  )
  const fetch = vi.fn(async () => ({ status: 409, ok: false, json: async () => ({ error: 'List limit reached' }) }))
  vi.stubGlobal('fetch', fetch)
  await expect(api('POST', '/lists', { name: 'x' })).rejects.toThrow('List limit reached')
  expect(fetch).toHaveBeenCalledWith(
    expect.stringMatching(/\/lists$/),
    expect.objectContaining({
      headers: { authorization: 'Bearer abc', 'content-type': 'application/json' },
    }),
  )
})

test('api redirects to login on 401', async () => {
  vi.stubGlobal('fetch', async () => ({ status: 401, ok: false }))
  const signinRedirect = vi.spyOn(UserManager.prototype, 'signinRedirect').mockResolvedValue()
  await expect(api('GET', '/data')).rejects.toThrow('Session expired')
  expect(signinRedirect).toHaveBeenCalled()
})

test('handleRedirect does nothing without a code', async () => {
  const signinCallback = vi.spyOn(UserManager.prototype, 'signinCallback')
  const replaceState = vi.spyOn(window.history, 'replaceState')
  await handleRedirect()
  expect(signinCallback).not.toHaveBeenCalled()
  expect(replaceState).not.toHaveBeenCalled()
})

test('handleRedirect swallows a failed callback and strips the code', async () => {
  vi.stubGlobal('location', { ...window.location, search: '?code=c', pathname: '/' })
  const replaceState = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {})
  await expect(handleRedirect()).resolves.toBeUndefined()
  expect(replaceState).toHaveBeenCalledWith(null, '', '/')
  expect(localStorage.getItem(userKey)).toBeNull()
})
