/** Shimmering loading placeholder. Size it with width/height or a className. */
export default function Skeleton({ width, height = '0.75rem', radius = 'var(--radius-sm)', className = '', style }) {
  return (
    <span
      className={`fx-shimmer ${className}`}
      style={{ display: 'block', width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  )
}
