/**
 * Lock page scrolling while a dialog, drawer or mobile menu is open.
 *
 * Only <html> gets `overflow: hidden`. Setting it on <body> as well turns <body>
 * into its own scroll container (scrollTop 0), which breaks every
 * `position: sticky` element: the app shell sidebar jumped up by the page's
 * scroll distance whenever a drawer opened. With <html> alone the viewport stays
 * the scroll container, so sticky elements keep their place and the scroll
 * position is preserved.
 *
 * `scrollbar-gutter: stable` on <html> (global.css) keeps the scrollbar's space
 * reserved, so the layout doesn't shift sideways when the scrollbar disappears.
 * Reference-counting keeps the page locked while overlays stack.
 */
let locks = 0
let restore = null

export function lockPageScroll() {
  if (typeof document === 'undefined') return () => {}
  if (locks === 0) {
    const root = document.documentElement
    const previous = { overflow: root.style.overflow, overscroll: root.style.overscrollBehavior }
    root.style.overflow = 'hidden'
    root.style.overscrollBehavior = 'none'
    restore = () => {
      root.style.overflow = previous.overflow
      root.style.overscrollBehavior = previous.overscroll
    }
  }
  locks += 1
  let released = false
  return () => {
    if (released) return
    released = true
    locks = Math.max(0, locks - 1)
    if (locks === 0) {
      restore?.()
      restore = null
    }
  }
}
