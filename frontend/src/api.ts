import { UserManager, WebStorageStateStore } from 'oidc-client-ts'

const API_URL = import.meta.env.VITE_API_URL
const COGNITO_URL = import.meta.env.VITE_COGNITO_URL
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID
const APP_URL = window.location.origin + import.meta.env.BASE_URL

const userManager = new UserManager({
  authority: COGNITO_URL,
  metadata: {
    authorization_endpoint: `${COGNITO_URL}/oauth2/authorize`,
    token_endpoint: `${COGNITO_URL}/oauth2/token`,
  },
  client_id: CLIENT_ID,
  redirect_uri: APP_URL,
  scope: 'openid email',
  userStore: new WebStorageStateStore({ store: localStorage }),
})

let justSignedIn = false

export const login = () => userManager.signinRedirect()

export const logout = async () => {
  await userManager.removeUser()
  const params = new URLSearchParams({ client_id: CLIENT_ID, logout_uri: APP_URL })
  window.location.assign(`${COGNITO_URL}/logout?${params}`)
}

export const handleRedirect = async () => {
  const params = new URLSearchParams(window.location.search)
  if (!params.has('code') && !params.has('error')) return
  justSignedIn = true
  await userManager.signinCallback().catch(() => {})
  window.history.replaceState(null, '', window.location.pathname)
}

export const api = async (method: string, path: string, body?: object) => {
  const response = await fetch(API_URL + path, {
    method,
    headers: {
      authorization: `Bearer ${(await userManager.getUser())?.access_token}`,
      ...(body && { 'content-type': 'application/json' }),
    },
    body: body && JSON.stringify(body),
  })
  if (response.status === 401) {
    if (justSignedIn) throw new Error('Sign-in failed')
    await login()
    throw new Error('Session expired')
  }
  if (response.status === 204) return null
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`)
  return data
}
