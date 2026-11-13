import { useEffect, useRef, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import Button from '../ui/Button'
import authService from '../../services/authService'
import styles from './GoogleSignInButton.module.css'

/*
  Google Identity Services button. Logic carried over from the previous app:
  GET /auth/config supplies { enabled, client_id }; Google's own button is
  rendered into the container (popup mode).
  Google draws the button inside its own iframe, so only Google's themes are
  possible (outline/white, filled_blue, filled_black). 'outline' is used in
  BOTH themes: filled_black's charcoal clashes with the navy dark mode.
*/
const MAX_WIDTH = 400
const MIN_WIDTH = 240
let configPromise

const loadConfig = () => {
  if (!configPromise) {
    configPromise = authService.getConfig()
      .then((response) => response.data?.data?.google || { enabled: false, client_id: null })
      .catch(() => ({ enabled: false, client_id: null }))
  }
  return configPromise
}

const loadScript = () => new Promise((resolve, reject) => {
  if (window.google?.accounts?.id) {
    resolve(window.google)
    return
  }
  const existing = document.querySelector('script[data-google-identity]')
  if (existing) {
    existing.addEventListener('load', () => resolve(window.google), { once: true })
    existing.addEventListener('error', reject, { once: true })
    return
  }
  const script = document.createElement('script')
  script.src = 'https://accounts.google.com/gsi/client?hl=en'
  script.async = true
  script.defer = true
  script.dataset.googleIdentity = 'true'
  script.onload = () => resolve(window.google)
  script.onerror = reject
  document.head.appendChild(script)
})

const widthFor = (el) => Math.max(MIN_WIDTH, Math.min(Math.floor(el?.getBoundingClientRect().width || MAX_WIDTH), MAX_WIDTH))

export default function GoogleSignInButton({ onCredential, disabled = false, context = 'signin' }) {
  const containerRef = useRef(null)
  const [config, setConfig] = useState({ loading: true, enabled: false, client_id: null })
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    loadConfig().then((google) => {
      if (active) setConfig({ loading: false, ...google })
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (config.loading || !config.enabled || !config.client_id || disabled) return undefined
    let cancelled = false
    let observer
    loadScript()
      .then((google) => {
        if (cancelled || !containerRef.current) return
        google.accounts.id.initialize({
          client_id: config.client_id,
          callback: ({ credential }) => onCredential(credential),
          context,
          ux_mode: 'popup',
          auto_select: false,
        })
        const render = () => {
          if (cancelled || !containerRef.current) return
          containerRef.current.innerHTML = ''
          google.accounts.id.renderButton(containerRef.current, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            shape: 'rectangular',
            text: context === 'signup' ? 'signup_with' : 'continue_with',
            width: String(widthFor(containerRef.current)),
            logo_alignment: 'left',
            locale: 'en',
          })
        }
        render()
        if (typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(render)
          observer.observe(containerRef.current)
        }
      })
      .catch(() => setFailed(true))
    return () => {
      cancelled = true
      observer?.disconnect()
    }
  }, [config, context, disabled, onCredential])

  if (config.loading) {
    return <Button variant="secondary" size="lg" block loading disabled>Preparing Google Sign-In</Button>
  }

  if (!config.enabled || !config.client_id || failed) {
    return (
      <Button variant="secondary" size="lg" block disabled>
        Google sign-in {failed ? 'unavailable' : 'not configured'}
      </Button>
    )
  }

  return (
    <div className={styles.shell} data-disabled={disabled || undefined}>
      <div className={styles.button} ref={containerRef} aria-label="Continue with Google" />
      <p className={styles.note}>
        <ShieldCheck size={14} aria-hidden="true" />
        Secured authentication by Google
      </p>
    </div>
  )
}
