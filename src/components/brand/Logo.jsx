import logoLight from '../../assets/brand/digitalinvoice-logo-light.svg'
import logoDark from '../../assets/brand/digitalinvoice-logo-dark.svg'
import compactLight from '../../assets/brand/digitalinvoice-logo-compact-light.svg'
import compactDark from '../../assets/brand/digitalinvoice-logo-compact-dark.svg'
import icon from '../../assets/brand/digitalinvoice-icon.svg'

const RATIO = 2392 / 510 // full and compact logos share the same canvas

/**
 * DigitalInvoice logo. Both theme versions render; CSS shows the right one,
 * so there's no flash and the hidden one is never downloaded.
 *
 * variant  'full' (with tagline) | 'compact' (no tagline, use below ~56px) | 'icon'
 * tone     'auto' follows the theme | 'on-dark' for navy surfaces (sidebar)
 */
export default function Logo({ variant = 'compact', tone = 'auto', height = 28, className = '', alt = 'DigitalInvoice' }) {
  if (variant === 'icon') {
    return <img src={icon} alt={alt} width={Math.round(height * 495 / 510)} height={height} className={className} />
  }
  const light = variant === 'full' ? logoLight : compactLight
  const dark = variant === 'full' ? logoDark : compactDark
  const size = { width: Math.round(height * RATIO), height, style: { height, width: 'auto' } }
  if (tone === 'on-dark') return <img src={dark} alt={alt} className={className} {...size} />
  return (
    <span className={className} style={{ display: 'inline-flex' }}>
      <img src={light} alt={alt} className="on-light-only" {...size} />
      <img src={dark} alt="" aria-hidden="true" className="on-dark-only" {...size} />
    </span>
  )
}
