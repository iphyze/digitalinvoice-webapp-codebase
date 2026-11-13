import { Suspense, useEffect } from 'react'
import useAuthStore from './stores/useAuthStore'
import useThemeStore from './stores/useThemeStore'
import AppRoutes from './app/routes'
import PageLoader from './components/ui/PageLoader'
import useSessionKeepAlive from './hooks/useSessionKeepAlive'
import Toaster from './components/ui/Toaster'
import RouteExperience from './components/navigation/RouteExperience'

export default function App() {
  const initializeAuth = useAuthStore((s) => s.initialize)
  const initializeTheme = useThemeStore((s) => s.init)
  useSessionKeepAlive()

  useEffect(() => initializeTheme(), [initializeTheme])
  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  return (
    <>
      <RouteExperience />
      <Suspense fallback={<PageLoader message="Loading your DigitalInvoice experience…" />}>
        <AppRoutes />
      </Suspense>
      <Toaster />
    </>
  )
}
