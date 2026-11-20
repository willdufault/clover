import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { handleRedirect, hasValidToken, login } from './api'

await handleRedirect()
const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')
if (hasValidToken()) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} else {
  await login()
}
