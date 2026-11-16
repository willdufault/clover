import { api, hasValidToken } from '../../src/api'

const token = (exp: number) => `x.${btoa(JSON.stringify({ exp }))}.y`

beforeEach(() => localStorage.clear())

test('hasValidToken checks presence and expiry', () => {
  expect(hasValidToken()).toBe(false)
  localStorage.setItem('idToken', token(2000))
  expect(hasValidToken(1999_000)).toBe(true)
  expect(hasValidToken(2000_000)).toBe(false)
})

test('api sends the id token and throws the server error message', async () => {
  localStorage.setItem('idToken', 'abc')
  const fetch = vi.fn(async () => ({ status: 409, ok: false, json: async () => ({ error: 'list limit reached' }) }))
  vi.stubGlobal('fetch', fetch)
  await expect(api('POST', '/lists', { name: 'x' })).rejects.toThrow('list limit reached')
  expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/lists$/), expect.objectContaining({
    headers: { authorization: 'Bearer abc', 'content-type': 'application/json' },
  }))
})

test('api redirects to login on 401', async () => {
  vi.stubGlobal('fetch', async () => ({ status: 401, ok: false }))
  const assign = vi.fn()
  vi.stubGlobal('location', { ...window.location, assign, origin: 'http://localhost:5173' })
  await expect(api('GET', '/data')).rejects.toThrow('Session expired')
  expect(assign).toHaveBeenCalledWith(expect.stringContaining('/oauth2/authorize?'))
})
