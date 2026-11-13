import { SearchX } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import StatusPage from './StatusPage';
import useAuthStore from '../../stores/useAuthStore';

export default function NotFound() {
  const pathname = useLocation().pathname;
  const authenticated = useAuthStore((state) => state.isAuthenticated());
  const home = useAuthStore((state) => state.nextPath());
  const attempted = pathname.length > 90 ? `${pathname.slice(0, 87)}…` : pathname;

  return (
    <StatusPage
      icon={SearchX}
      code="404 · Page not found"
      title="This page doesn't exist"
      message={`We couldn't find ${attempted}. The link may have changed, or the address may have been mistyped.`}
      tone="info"
      action={{ label: authenticated ? 'Return to your workspace' : 'Return to DigitalInvoice', to: authenticated ? home : '/' }}
    />
  );
}
