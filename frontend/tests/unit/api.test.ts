import { UserManager } from 'oidc-client-ts'

let api: typeof import('../../src/api').api
let handleRedirect: typeof import('../../src/api').handleRedirect
let logout: typeof import('../../src/api').logout

const issuer = import.meta.env.VITE_COGNITO_ISSUER
const cognitoUrl = import.meta.env.VITE_COGNITO_URL
const userKey = `oidc.user:${issuer}:${import.meta.env.VITE_COGNITO_CLIENT_ID}`
const discovery = {
  issuer,
  authorization_endpoint: `${cognitoUrl}/oauth2/authorize`,
  token_endpoint: `${cognitoUrl}/oauth2/token`,
  revocation_endpoint: `${cognitoUrl}/oauth2/revoke`,
  jwks_uri: `${issuer}/.well-known/jwks.json`,
}

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const storeUser = (expires_at: number) =>
  localStorage.setItem(
    userKey,
    JSON.stringify({
      access_token: 'old',
      refresh_token: 'r',
      token_type: 'Bearer',
      scope: 'openid email',
      profile: { sub: 'u' },
      expires_at,
    }),
  )

const mockCognito = (token: Response, other: Response) => {
  const fetch = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url === `${issuer}/.well-known/openid-configuration`) return json(discovery)
    if (url === discovery.token_endpoint) return token
    if (url === discovery.revocation_endpoint) return new Response(null, { status: 200 })
    return other
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

const bodies = (fetch: ReturnType<typeof mockCognito>, url: string) =>
  fetch.mock.calls.filter(([u]) => u === url).map(([, init]) => Object.fromEntries(init?.body as URLSearchParams))

beforeEach(async () => {
  localStorage.clear()
  vi.restoreAllMocks()
  vi.resetModules()
  ;({ api, handleRedirect, logout } = await import('../../src/api'))
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

test('api throws instead of redirecting after a failed callback', async () => {
  vi.stubGlobal('location', { ...window.location, search: '?code=c', pathname: '/' })
  vi.spyOn(window.history, 'replaceState').mockImplementation(() => {})
  await handleRedirect()
  vi.stubGlobal('fetch', async () => ({ status: 401, ok: false }))
  const signinRedirect = vi.spyOn(UserManager.prototype, 'signinRedirect').mockResolvedValue()
  await expect(api('GET', '/data')).rejects.toThrow('Sign-in failed')
  expect(signinRedirect).not.toHaveBeenCalled()
})

test('api returns null on 204', async () => {
  vi.stubGlobal('fetch', async () => ({ status: 204, ok: true }))
  await expect(api('DELETE', '/lists/1')).resolves.toBeNull()
})

test('api throws a generic error when the response has no error field', async () => {
  vi.stubGlobal('fetch', async () => ({ status: 500, ok: false, json: async () => ({}) }))
  await expect(api('GET', '/data')).rejects.toThrow('Request failed (500)')
})

test('api throws instead of redirecting after a successful callback', async () => {
  vi.stubGlobal('location', { ...window.location, search: '?code=c', pathname: '/' })
  vi.spyOn(window.history, 'replaceState').mockImplementation(() => {})
  vi.spyOn(UserManager.prototype, 'signinCallback').mockResolvedValue(undefined)
  await handleRedirect()
  vi.stubGlobal('fetch', async () => ({ status: 401, ok: false }))
  const signinRedirect = vi.spyOn(UserManager.prototype, 'signinRedirect').mockResolvedValue()
  await expect(api('GET', '/data')).rejects.toThrow('Sign-in failed')
  expect(signinRedirect).not.toHaveBeenCalled()
})

test('handleRedirect strips a Cognito error and blocks a second redirect', async () => {
  vi.stubGlobal('location', { ...window.location, search: '?error=access_denied', pathname: '/' })
  const replaceState = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {})
  await handleRedirect()
  expect(replaceState).toHaveBeenCalledWith(null, '', '/')
  vi.stubGlobal('fetch', async () => ({ status: 401, ok: false }))
  const signinRedirect = vi.spyOn(UserManager.prototype, 'signinRedirect').mockResolvedValue()
  await expect(api('GET', '/data')).rejects.toThrow('Sign-in failed')
  expect(signinRedirect).not.toHaveBeenCalled()
})

test('api refreshes an expired token before the request', async () => {
  storeUser(1)
  const fetch = mockCognito(
    json({ access_token: 'new', token_type: 'Bearer', expires_in: 3600 }),
    new Response(null, { status: 204 }),
  )
  await expect(api('GET', '/data')).resolves.toBeNull()
  expect(bodies(fetch, discovery.token_endpoint)).toEqual([
    expect.objectContaining({ grant_type: 'refresh_token', refresh_token: 'r' }),
  ])
  expect(fetch).toHaveBeenLastCalledWith(
    expect.stringMatching(/\/data$/),
    expect.objectContaining({ headers: { authorization: 'Bearer new' } }),
  )
})

test('api does not refresh a valid token', async () => {
  storeUser(9999999999)
  const fetch = mockCognito(json({}), new Response(null, { status: 204 }))
  await api('GET', '/data')
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith(
    expect.stringMatching(/\/data$/),
    expect.objectContaining({ headers: { authorization: 'Bearer old' } }),
  )
})

test('api redirects to login when the refresh fails', async () => {
  storeUser(1)
  mockCognito(json({ error: 'invalid_grant' }, 400), new Response(null, { status: 401 }))
  const signinRedirect = vi.spyOn(UserManager.prototype, 'signinRedirect').mockResolvedValue()
  await expect(api('GET', '/data')).rejects.toThrow('Session expired')
  expect(signinRedirect).toHaveBeenCalled()
})

test('logout revokes only the refresh token and redirects to Cognito logout', async () => {
  storeUser(9999999999)
  const fetch = mockCognito(json({}), new Response(null, { status: 204 }))
  const assign = vi.fn()
  vi.stubGlobal('location', { ...window.location, assign })
  await logout()
  expect(bodies(fetch, discovery.revocation_endpoint)).toEqual([
    expect.objectContaining({ token: 'r', token_type_hint: 'refresh_token' }),
  ])
  expect(localStorage.getItem(userKey)).toBeNull()
  expect(assign).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^${cognitoUrl}/logout\\?`)))
})

test('api redirects to login without a stored user and never tries a silent sign-in', async () => {
  const fetch = mockCognito(json({}), new Response(null, { status: 401 }))
  const signinSilent = vi.spyOn(UserManager.prototype, 'signinSilent').mockResolvedValue(null)
  const signinRedirect = vi.spyOn(UserManager.prototype, 'signinRedirect').mockResolvedValue()
  await expect(api('GET', '/data')).rejects.toThrow('Session expired')
  expect(signinSilent).not.toHaveBeenCalled()
  expect(signinRedirect).toHaveBeenCalled()
  expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/data$/), expect.anything())
})

test('api redirects on a later 401 once a request after the callback succeeds', async () => {
  vi.stubGlobal('location', { ...window.location, search: '?code=c', pathname: '/' })
  vi.spyOn(window.history, 'replaceState').mockImplementation(() => {})
  vi.spyOn(UserManager.prototype, 'signinCallback').mockResolvedValue(undefined)
  await handleRedirect()
  vi.stubGlobal('fetch', async () => ({ status: 204, ok: true }))
  await api('GET', '/data')
  vi.stubGlobal('fetch', async () => ({ status: 401, ok: false }))
  const signinRedirect = vi.spyOn(UserManager.prototype, 'signinRedirect').mockResolvedValue()
  await expect(api('GET', '/data')).rejects.toThrow('Session expired')
  expect(signinRedirect).toHaveBeenCalled()
})
