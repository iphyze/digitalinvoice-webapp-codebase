import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import Spinner from './Spinner'
import styles from './Button.module.css'

/**
 * Button, or a link styled as one (pass `to` for in-app links, `href` for external).
 *
 * variant   'primary' | 'secondary' | 'ghost' | 'danger'
 * size      'sm' (32px) | 'md' (38px) | 'lg' (44px)
 * loading   shows a spinner, keeps the width, disables the button
 * icon / iconRight  a lucide-react icon component
 * block     full width
 */
const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, icon: Icon, iconRight: IconRight, block = false,
    to, href, type = 'button', disabled, className = '', children, ...rest },
  ref,
) {
  const classes = [styles.button, styles[variant], styles[size], block ? styles.block : '', className].join(' ')
  const content = (
    <>
      {loading ? <Spinner size={size === 'lg' ? 18 : 16} className={styles.spinner} /> : null}
      <span className={styles.inner} data-hidden={loading || undefined}>
        {Icon ? <Icon size={size === 'sm' ? 15 : 17} strokeWidth={2} aria-hidden="true" /> : null}
        {children ? <span>{children}</span> : null}
        {IconRight ? <IconRight size={size === 'sm' ? 15 : 17} strokeWidth={2} aria-hidden="true" /> : null}
      </span>
    </>
  )
  if (to) return <Link ref={ref} to={to} className={classes} {...rest}>{content}</Link>
  if (href) return <a ref={ref} href={href} className={classes} {...rest}>{content}</a>
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  )
})

export default Button
