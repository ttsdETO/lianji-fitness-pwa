import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { lockPortraitOrientation } from './lib/orientation'
import './styles.css'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

const requestPortraitLock = () => { void lockPortraitOrientation() }
requestPortraitLock()
window.addEventListener('pointerdown', requestPortraitLock, { once: true, passive: true })
window.addEventListener('orientationchange', requestPortraitLock)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') requestPortraitLock()
})

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('Service worker registration failed', error))
  })
}
