import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Show every date and time in India time (IST), whatever time zone the viewing computer is set to.
// Calls that pass their own timeZone keep it.
for (const method of ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString'] as const) {
  const original = Date.prototype[method]
  Date.prototype[method] = function (this: Date, locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
    return original.call(this, locales, { timeZone: 'Asia/Kolkata', ...options })
  }
}

// Scrolling the page with the mouse over a focused number box would silently change its value —
// drop focus instead so the wheel just scrolls.
document.addEventListener('wheel', () => {
  const el = document.activeElement
  if (el instanceof HTMLInputElement && el.type === 'number') el.blur()
}, { passive: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
