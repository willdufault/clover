const API_URL = import.meta.env.VITE_API_URL
const COGNITO_URL = import.meta.env.VITE_COGNITO_URL
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export const login = async () => {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)))
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  localStorage.setItem('verifier', verifier)
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: window.location.origin,
    scope: 'openid email',
    code_challenge_method: 'S256',
    code_challenge: base64url(new Uint8Array(hash)),
  })
  window.location.assign(`${COGNITO_URL}/oauth2/authorize?${params}`)
}

export const logout = () => {
  localStorage.removeItem('idToken')
  const params = new URLSearchParams({ client_id: CLIENT_ID, logout_uri: window.location.origin })
  window.location.assign(`${COGNITO_URL}/logout?${params}`)
}

// Exchanges the ?code= from the hosted UI redirect for tokens, if present.
export const handleRedirect = async () => {
  const code = new URLSearchParams(window.location.search).get('code')
  if (!code) return
  window.history.replaceState(null, '', window.location.pathname)
  const response = await fetch(`${COGNITO_URL}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code,
      redirect_uri: window.location.origin,
      code_verifier: localStorage.getItem('verifier') ?? '',
    }),
  })
  localStorage.removeItem('verifier')
  if (response.ok) localStorage.setItem('idToken', (await response.json()).id_token)
}

export const hasValidToken = (now = Date.now()) => {
  const token = localStorage.getItem('idToken')
  if (!token) return false
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.exp * 1000 > now
  } catch {
    return false
  }
}

// The JWT authorizer checks the audience, which only the id token has.
export const api = async (method: string, path: string, body?: object) => {
  const response = await fetch(API_URL + path, {
    method,
    headers: {
      authorization: `Bearer ${localStorage.getItem('idToken')}`,
      ...(body && { 'content-type': 'application/json' }),
    },
    body: body && JSON.stringify(body),
  })
  if (response.status === 401) {
    await login()
    throw new Error('Session expired.')
  }
  if (response.status === 204) return null
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status}).`)
  return data
}
