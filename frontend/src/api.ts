import { UserManager, WebStorageStateStore } from 'oidc-client-ts'

const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID
const APP_URL = window.location.origin + import.meta.env.BASE_URL

const userManager = new UserManager({
  authority: import.meta.env.VITE_COGNITO_ISSUER,
  client_id: CLIENT_ID,
  redirect_uri: APP_URL,
  scope: 'openid email',
  userStore: new WebStorageStateStore({ store: localStorage }),
  revokeTokenTypes: ['refresh_token'],
})

let justSignedIn = false

export const logout = async () => {
  await userManager.revokeTokens().catch(() => {})
  await userManager.removeUser()
  const params = new URLSearchParams({ client_id: CLIENT_ID, logout_uri: APP_URL })
  window.location.assign(`${import.meta.env.VITE_COGNITO_URL}/logout?${params}`)
}

export const handleRedirect = async () => {
  const params = new URLSearchParams(window.location.search)
  if (!params.has('code') && !params.has('error')) return
  justSignedIn = true
  await userManager.signinCallback().catch(() => {})
  window.history.replaceState(null, '', window.location.pathname)
}

const getAccessToken = async () => {
  const user = await userManager.getUser()
  if (!user?.expired) return user?.access_token
  return (await userManager.signinSilent().catch(() => null))?.access_token
}

export const api = async <T>(method: string, path: string, body?: object): Promise<T> => {
  const response = await fetch(import.meta.env.VITE_API_URL + path, {
    method,
    headers: {
      authorization: `Bearer ${await getAccessToken()}`,
      ...(body && { 'content-type': 'application/json' }),
    },
    body: body && JSON.stringify(body),
  })
  if (response.status === 401) {
    if (justSignedIn) throw new Error('Sign-in failed')
    await userManager.signinRedirect()
    throw new Error('Session expired')
  }
  justSignedIn = false
  if (response.status === 204) return null as T
  const data = (await response.json()) as { error?: string }
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`)
  return data as T
}
