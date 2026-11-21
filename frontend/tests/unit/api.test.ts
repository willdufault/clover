import { api, handleRedirect } from '../../src/api'

beforeEach(() => localStorage.clear())

test('api sends the id token and throws the server error message', async () => {
  localStorage.setItem('idToken', 'abc')
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
  const assign = vi.fn()
  vi.stubGlobal('location', { ...window.location, assign, origin: 'http://localhost:5173' })
  await expect(api('GET', '/data')).rejects.toThrow('Session expired')
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

test('handleRedirect throws on a failed token exchange', async () => {
  vi.stubGlobal('location', { ...window.location, search: '?code=c', pathname: '/', origin: 'http://localhost:5173' })
  vi.spyOn(window.history, 'replaceState').mockImplementation(() => {})
  vi.stubGlobal('fetch', async () => ({ ok: false, status: 400 }))
  await expect(handleRedirect()).rejects.toThrow('Token exchange failed: 400')
  expect(localStorage.getItem('idToken')).toBeNull()
})
