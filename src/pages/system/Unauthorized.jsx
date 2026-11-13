import { ShieldAlert } from 'lucide-react'
import StatusPage from './StatusPage'

// Copy from the previous app
export default function Unauthorized() {
  return (
    <StatusPage icon={ShieldAlert} code="403 · Restricted" title="Access restricted" tone="danger"
      message="You do not have permission to access this area of the workspace." action={{ label: 'Return to dashboard', to: '/app/dashboard' }} />
  )
}
