import { forwardRef, useState } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import TextField from './TextField'
import styles from './PasswordField.module.css'

/** TextField for passwords with a show/hide toggle (icon swaps smoothly). */
const PasswordField = forwardRef(function PasswordField({ icon = Lock, ...props }, ref) {
  const [visible, setVisible] = useState(false)
  return (
    <TextField
      ref={ref}
      icon={icon}
      type={visible ? 'text' : 'password'}
      trailing={(
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          <span className={styles.swap} data-on={!visible}><Eye size={17} aria-hidden="true" /></span>
          <span className={styles.swap} data-on={visible}><EyeOff size={17} aria-hidden="true" /></span>
        </button>
      )}
      {...props}
    />
  )
})

export default PasswordField
