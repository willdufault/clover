import { api, handleRedirect, hasValidToken } from '../../src/api'

const token = (exp: number) => `x.${btoa(JSON.stringify({ exp }))}.y`

beforeEach(() => localStorage.clear())

test('hasValidToken checks presence and expiry', () => {
  expect(hasValidToken()).toBe(false)
  localStorage.setItem('idToken', token(2000))
  expect(hasValidToken(1999_000)).toBe(true)
  expect(hasValidToken(2000_000)).toBe(false)

  // JWT payloads are base64url: '-' and '_' instead of '+' and '/', no padding.
  const payload = btoa(JSON.stringify({ exp: 2000, sub: '????>' }))
  expect(payload).toMatch(/\+.*\/|\/.*\+/)
  const urlSafe = payload.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  localStorage.setItem('idToken', `x.${urlSafe}.y`)
  expect(hasValidToken(1999_000)).toBe(true)

  localStorage.setItem('idToken', 'not-a-token')
  expect(hasValidToken()).toBe(false)
})

test('api sends the id token and throws the server error message', async () => {
  localStorage.setItem('idToken', 'abc')
  const fetch = vi.fn(async () => ({ status: 409, ok: false, json: async () => ({ error: 'List limit reached.' }) }))
  vi.stubGlobal('fetch', fetch)
  await expect(api('POST', '/lists', { name: 'x' })).rejects.toThrow('List limit reached.')
  expect(fetch).toHaveBeenCalledWith(
    expect.stringMatching(/\/lists$/),
    expect.objectContaining({
      headers: { authorization: 'Bearer abc', 'content-type': 'application/json' },
    }),
  )
})

test('api redirects to login on 401', async () => {
  vi.stubGlobal('fetch', async () => ({ status: 401, ok: false }))
  const assign = vi.fn()
  vi.stubGlobal('location', { ...window.location, assign, origin: 'http://localhost:5173' })
  await expect(api('GET', '/data')).rejects.toThrow('Session expired.')
  expect(assign).toHaveBeenCalledWith(expect.stringContaining('/oauth2/authorize?'))
})

test('handleRedirect stores the id token and removes the verifier', async () => {
  localStorage.setItem('verifier', 'v')
  vi.stubGlobal('location', { ...window.location, search: '?code=c', pathname: '/', origin: 'http://localhost:5173' })
  vi.spyOn(window.history, 'replaceState').mockImplementation(() => {})
  vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ id_token: 'tok' }) }))
  await handleRedirect()
  expect(localStorage.getItem('idToken')).toBe('tok')
  expect(localStorage.getItem('verifier')).toBeNull()
})
