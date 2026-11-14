import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import ConfirmDialog from '../overlays/ConfirmDialog'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import styles from './SignOutAction.module.css'

/** Consistent sign-out control for the pre-workspace onboarding and subscription headers. */
export default function SignOutAction({ hasUnsavedChanges = false, disabled = false }) {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const showToast = useToastStore((state) => state.showToast)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const signOut = async () => {
    if (signingOut || disabled) return
    setSigningOut(true)
    try {
      await logout()
      showToast('You have been signed out securely.', 'success', 'Signed out')
      navigate('/login', { replace: true })
    } finally {
      setSigningOut(false)
      setConfirmOpen(false)
    }
  }

  const requestSignOut = () => {
    if (disabled || signingOut) return
    if (hasUnsavedChanges) setConfirmOpen(true)
    else void signOut()
  }

  return (
    <>
      <button
        type="button"
        className={styles.action}
        onClick={requestSignOut}
        disabled={disabled || signingOut}
        aria-label="Sign out"
        title="Sign out"
        aria-busy={signingOut || undefined}
      >
        <LogOut size={17} aria-hidden="true" />
        <span className={styles.label}>{signingOut ? 'Signing out…' : 'Sign out'}</span>
      </button>
      <ConfirmDialog
        open={confirmOpen}
        title="Sign out now?"
        message="Sign out now? Changes on this step that you haven't saved will be lost."
        confirmLabel="Sign out"
        variant="danger"
        loading={signingOut}
        onClose={() => setConfirmOpen(false)}
        onConfirm={signOut}
      />
    </>
  )
}
