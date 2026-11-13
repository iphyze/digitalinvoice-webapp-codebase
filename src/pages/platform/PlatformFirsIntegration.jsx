import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpenCheck, Database, KeyRound, LockKeyhole, PencilLine, RefreshCw, Save, ServerCog, ShieldAlert, ShieldCheck, TestTube2, Activity, FileCheck2 } from 'lucide-react'
import SummaryStat from '../../components/data/SummaryStat'
import PageHeader from '../../components/shell/PageHeader'
import PageLoader from '../../components/ui/PageLoader'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import StatusBadge from '../../components/ui/StatusBadge'
import DataTable from '../../components/data/DataTable'
import TextField from '../../components/forms/TextField'
import Select from '../../components/forms/Select'
import Switch from '../../components/forms/Switch'
import Textarea from '../../components/forms/Textarea'
import Drawer from '../../components/overlays/Drawer'
import ConfirmDialog from '../../components/overlays/ConfirmDialog'
import platformService from '../../services/platformService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { platformPermission } from '../../utils/platformPermissions'
import { getErrorMessage } from '../../utils/httpError'
import {
  FIRS_STATUSES, FIRS_ENVIRONMENTS, buildFirsPatch, entriesToResourceText,
  localDateTime, normalizeFirsForm, parseFirsOverview, parseResourceText, validateFirsForm,
} from './platformFirsModel'
import styles from './PlatformFirsIntegration.module.css'

const EMPTY_KEYS = { apiKey: '', secretKey: '' }

function Panel({ icon: Icon, title, description, children, actions }) {
  return <section className={styles.panel} aria-label={title}>
    <div className={styles.panelHead}>
      <span className={styles.panelIcon}><Icon size={20} aria-hidden="true" /></span>
      <div className={styles.panelTitle}><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>
      {actions ? <div className={styles.panelActions}>{actions}</div> : null}
    </div>
    {children}
  </section>
}

function Metric({ icon, label, value, note }) {
  return <SummaryStat icon={icon} label={label} value={value} note={note} />
}

export default function PlatformFirsIntegration() {
  const actor = useAuthStore((state) => state.user)
  const access = useAuthStore((state) => state.platformAccess)
  const canManage = platformPermission(access, actor, 'platform.firs.manage')
  const toast = useToastStore((state) => state.showToast)
  const [overview, setOverview] = useState(null)
  const [form, setForm] = useState(null)
  const [saved, setSaved] = useState(null)
  const [credentials, setCredentials] = useState(EMPTY_KEYS)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [loadingError, setLoadingError] = useState('')
  const [actionError, setActionError] = useState('')
  const [testMessage, setTestMessage] = useState('')
  const [discardOpen, setDiscardOpen] = useState(false)
  const [resourceDraft, setResourceDraft] = useState(null)
  const [savingResource, setSavingResource] = useState(false)

  const dirty = useMemo(() => Boolean(form && saved && Object.keys(buildFirsPatch(form, saved, credentials)).length), [form, saved, credentials])
  const flags = overview?.settings?.flags || {}
  const summary = overview?.summary || {}
  const resources = overview?.resources || []
  const logs = overview?.recent_logs || []
  const sensitive = overview?.settings?.sensitive || {}

  const applyOverview = useCallback((result) => {
    const next = parseFirsOverview(result)
    const values = normalizeFirsForm(next.settings.settings)
    setOverview(next)
    setForm(values)
    setSaved(values)
    setCredentials(EMPTY_KEYS)
    setErrors({})
    setActionError('')
    return next
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadingError('')
    setTestMessage('')
    try {
      applyOverview(await platformService.firsIntegration())
    } catch (error) {
      setLoadingError(getErrorMessage(error, 'Unable to load NRS/MBS integration settings.'))
    } finally { setLoading(false) }
  }, [applyOverview])

  useEffect(() => { load() }, [load])

  const update = (key, value) => {
    if (!canManage || saving) return
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((old) => ({ ...old, [key]: '' }))
    setActionError('')
    setTestMessage('')
  }
  const updateKey = (key, value) => {
    if (!canManage || saving) return
    setCredentials((old) => ({ ...old, [key]: value }))
    setErrors((old) => ({ ...old, [key]: '' }))
    setActionError('')
    setTestMessage('')
  }
  const reset = () => {
    setForm({ ...saved })
    setCredentials(EMPTY_KEYS)
    setErrors({})
    setActionError('')
    setTestMessage('')
    setDiscardOpen(false)
  }

  const save = async (event) => {
    event?.preventDefault()
    if (!canManage || !dirty || saving) return
    const nextErrors = validateFirsForm(form, credentials)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      setActionError('Review the highlighted fields before saving.')
      return
    }
    setSaving(true)
    setActionError('')
    try {
      const response = await platformService.updateFirsIntegration(buildFirsPatch(form, saved, credentials))
      const data = response?.data?.data
      // PUT returns { settings, overview }; the overview is the GET schema.
      if (!data?.overview) throw new Error('Saved, but the updated settings could not be verified. Refresh this page.')
      applyOverview({ data: { data: data.overview } })
      setTestMessage('')
      toast('NRS/MBS integration settings saved.', 'success', 'Settings saved')
    } catch (error) {
      setActionError(getErrorMessage(error, 'Unable to save NRS/MBS integration settings.'))
    } finally { setSaving(false) }
  }

  const canTest = canManage && !dirty && !saving && !testing && !loading && Boolean(flags.sandbox_credentials_ready)
  const testSandbox = async () => {
    if (!canTest) return
    setTesting(true)
    setActionError('')
    setTestMessage('')
    try {
      const response = await platformService.nrsSandboxHealth()
      const result = response?.data?.data || {}
      if (result.environment !== 'sandbox' || result.invoice_submitted !== false || result.operation !== 'resource_currencies') {
        throw new Error('Unexpected sandbox health-check response. No clearance can be inferred.')
      }
      setTestMessage(`Sandbox resource authentication succeeded (HTTP ${result.http_status}). No invoice was submitted or cleared.`)
      toast('Sandbox resource endpoint responded successfully.', 'success', 'Connection tested')
    } catch (error) {
      setActionError(getErrorMessage(error, 'Sandbox test was blocked or unsuccessful. Check server configuration and credentials.'))
    } finally { setTesting(false) }
  }

  const openResource = (resource) => {
    if (!canManage) return
    setResourceDraft({ resource, text: entriesToResourceText(resource.payload), error: '' })
  }
  const saveResource = async () => {
    if (!resourceDraft || !canManage || savingResource) return
    let entries
    try {
      entries = parseResourceText(resourceDraft.text)
    } catch (error) {
      setResourceDraft((previous) => ({ ...previous, error: error.message }))
      return
    }
    setSavingResource(true)
    try {
      const response = await platformService.updateFirsResource({ resource_key: resourceDraft.resource.key, entries })
      applyOverview({ data: { data: response?.data?.data } })
      setResourceDraft(null)
      setTestMessage('')
      toast('Local NRS resource catalogue updated.', 'success', 'Resource saved')
    } catch (error) {
      setResourceDraft((previous) => previous ? {
        ...previous, error: getErrorMessage(error, 'Unable to save resource entries.'),
      } : previous)
    } finally { setSavingResource(false) }
  }

  const logColumns = [
    { key: 'created_at', header: 'Date and time', cell: (log) => <span className="num">{localDateTime(log.created_at)}</span> },
    { key: 'organization_name', header: 'Client', cell: (log) => log.organization_name || 'Platform-wide' },
    { key: 'invoice_number', header: 'Invoice', cell: (log) => <span className="ref">{log.invoice_number || '—'}</span> },
    { key: 'endpoint_key', header: 'Operation', cell: (log) => String(log.endpoint_key || '—').replaceAll('_', ' ') },
    { key: 'outcome', header: 'Outcome', cell: (log) => <StatusBadge status={log.outcome || 'pending'} /> },
  ]
  const controlDisabled = !canManage || saving
  const field = (key, label, hint, options = {}) => <TextField id={`firs-${key}`} label={label}
    value={form?.[key] ?? ''} onChange={(event) => update(key, event.target.value)}
    disabled={controlDisabled} hint={hint} error={errors[key]}
    maxLength={options.maxLength} placeholder={options.placeholder} autoComplete="off" />

  return <main className={styles.page}>
    <PageHeader eyebrow="Platform administration" title="NRS / MBS integration"
      description="Manage internal integration readiness, encrypted sandbox credentials, local resource catalogues and diagnostics."
      actions={<div className={styles.actions}>
        <Button variant="secondary" icon={RefreshCw} disabled={loading || saving || testing || savingResource || dirty}
          onClick={load}>Refresh</Button>
        {canManage && dirty ? <Button variant="ghost" onClick={() => setDiscardOpen(true)} disabled={saving}>Discard</Button> : null}
        {canManage && overview ? <Button icon={Save} onClick={save} loading={saving} disabled={!dirty || savingResource}>Save settings</Button> : null}
      </div>} />

    <Alert tone="warning" title="No live NRS submission">
      This page tracks configuration and offline preparation. A saved licence status, resource list or successful sandbox test does not establish regulatory accreditation or invoice clearance. Production submission and NRS Pay-Now remain disabled on the backend.
    </Alert>

    {loading && !overview ? <PageLoader inline message="Loading NRS integration settings…" /> : null}
    {loadingError ? <Alert tone="danger" title="Unable to load integration settings">
      {loadingError} <Button size="sm" variant="secondary" onClick={load}>Try again</Button>
    </Alert> : null}

    {overview && form ? <>
      {!canManage ? <Alert tone="info">You have read-only access to integration settings. Only permitted platform administrators can save settings, update local resources or test sandbox credentials.</Alert> : null}
      {actionError ? <Alert tone="danger" title="Action not completed" onDismiss={() => setActionError('')}>{actionError}</Alert> : null}
      {testMessage ? <Alert tone="success" title="Sandbox connection tested" onDismiss={() => setTestMessage('')}>{testMessage}</Alert> : null}
      <section className={styles.metrics} aria-label="NRS readiness summary">
        <Metric icon={ShieldCheck} label="Recorded integration status" value={FIRS_STATUSES.find((item) => item.value === form.firs_integration_status)?.label || 'Unspecified'} note="Internal setting only" />
        <Metric icon={KeyRound} label="Credentials" value={flags.credentials_present ? 'Stored' : 'Incomplete'} note="Encrypted server-side; never returned to browsers" />
        <Metric icon={FileCheck2} label="Local UBL preparations" value={Number(summary.total_preparations) || 0} note={`${Number(summary.ready) || 0} ready · ${Number(summary.blocked) || 0} blocked`} />
        <Metric icon={Activity} label="Diagnostics logged" value={Number(summary.api_logs) || 0} note="Historical readiness and sandbox calls" />
      </section>

      <div className={styles.grid}>
        <Panel icon={ShieldCheck} title="Integration status & environment" description="Internal operational tracking—not an NRS-issued licence verification.">
          <div className={styles.formGrid}>
            <Select label="Integration status" id="firs-status" value={form.firs_integration_status} options={FIRS_STATUSES}
              onChange={(value) => update('firs_integration_status', value)} isDisabled={controlDisabled}
              error={errors.firs_integration_status} />
            <Select label="Environment" id="firs-environment" value={form.firs_environment} options={FIRS_ENVIRONMENTS}
              onChange={(value) => update('firs_environment', value)} isDisabled={controlDisabled}
              error={errors.firs_environment} />
            {field('firs_base_url', 'Recorded base URL', 'Optional endpoint information; the sandbox HTTP client uses separately configured server variables.', { placeholder: 'https://…' })}
            {field('firs_merchant_id', 'Merchant / integrator ID', 'Enter the identifier only after it is issued.')}
            {field('firs_access_point_provider', 'Access point provider', 'Record the appointed provider when confirmed.')}
          </div>
          <div className={styles.locked}>
            <LockKeyhole size={19} aria-hidden="true" />
            <div><strong>Production and Pay-Now locked</strong><span>Production transport is not implemented. Neither setting can be enabled from this screen.</span></div>
          </div>
        </Panel>

        <Panel icon={KeyRound} title="Sandbox credentials" description="Replace keys securely. Existing values are never revealed or autofilled.">
          <div className={styles.formGrid}>
            <div className={styles.keyStatus}><span>API key</span><StatusBadge status={sensitive.firs_api_key ? 'active' : 'pending'} /><small>{sensitive.firs_api_key ? 'Stored on server' : 'Not configured'}</small></div>
            <TextField id="firs-api-key" label="New API key" type="password" autoComplete="new-password"
              placeholder="Leave blank to keep the stored key" value={credentials.apiKey}
              onChange={(event) => updateKey('apiKey', event.target.value)} disabled={controlDisabled} error={errors.apiKey} />
            <div className={styles.keyStatus}><span>Secret key</span><StatusBadge status={sensitive.firs_secret_key ? 'active' : 'pending'} /><small>{sensitive.firs_secret_key ? 'Stored on server' : 'Not configured'}</small></div>
            <TextField id="firs-secret-key" label="New secret key" type="password" autoComplete="new-password"
              placeholder="Leave blank to keep the stored key" value={credentials.secretKey}
              onChange={(event) => updateKey('secretKey', event.target.value)} disabled={controlDisabled} error={errors.secretKey} />
            <Switch id="firs-sandbox-toggle" label="Enable sandbox API testing"
              description="Only allows the read-only sandbox resources check when saved credentials and the separately approved server gate are ready."
              checked={form.firs_sandbox_enabled === '1'} onChange={(on) => update('firs_sandbox_enabled', on ? '1' : '0')}
              disabled={controlDisabled} />
          </div>
          <div className={styles.testArea}>
            <Button icon={TestTube2} variant="secondary" onClick={testSandbox} disabled={!canTest} loading={testing}>
              Test sandbox connection
            </Button>
            <p>{dirty ? 'Save your changes before running the sandbox test.'
              : !flags.sandbox_credentials_ready ? 'Requires a saved sandbox-ready status, sandbox environment, enabled testing, and both stored credentials.'
                : 'Sends only a read-only currencies-resource request to the NRS sandbox. It cannot submit invoices.'}</p>
          </div>
        </Panel>
      </div>

      <Panel icon={BookOpenCheck} title="Implementation notes" description="Record licence progress, onboarding contacts and technical actions for your team.">
        <Textarea id="firs-notes" label="Internal NRS/MBS implementation notes" rows={4} maxLength={4000}
          value={form.firs_notes} onChange={(event) => update('firs_notes', event.target.value)}
          disabled={controlDisabled} error={errors.firs_notes} />
        {canManage && dirty ? <div className={styles.saveRow}><span>Unsaved changes</span><Button icon={Save} onClick={save} loading={saving}>Save settings</Button></div> : null}
      </Panel>

      <Panel icon={Database} title="Local NRS resource catalogues"
        description="Imported or manually prepared local options are not certified NRS resource responses.">
        <div className={styles.resourceGrid}>
          {resources.length ? resources.map((resource) => <article key={resource.key} className={styles.resource}>
            <div className={styles.resourceTop}><strong>{resource.label || resource.key}</strong><span className={styles.resourceState}>{String(resource.status || 'pending').replaceAll('_', ' ')}</span></div>
            <p>{resource.description || 'Local resource options.'}</p>
            <span className={`${styles.endpoint} ref`}>{resource.endpoint || 'Local resource'}</span>
            <div className={styles.resourceFoot}><span className="num">{Number(resource.entries_count) || 0} entries</span>
              {canManage ? <Button size="sm" icon={PencilLine} variant="secondary" onClick={() => openResource(resource)}>Manage</Button> : null}
            </div>
          </article>) : <p className={styles.muted}>No resource catalogues are available yet.</p>}
        </div>
      </Panel>

      <Panel icon={ServerCog} title="Recent integration diagnostics" description="Last 10 recorded events from the API. This is not an official submission history.">
        <DataTable columns={logColumns} rows={logs} rowKey={(log) => log.id}
          empty={<div className={styles.empty}><ShieldAlert size={22} aria-hidden="true" /><p>No API diagnostics have been recorded yet.</p></div>} />
      </Panel>
    </> : null}

    <Drawer open={Boolean(resourceDraft)} title={resourceDraft?.resource?.label || 'Local resource catalogue'}
      eyebrow="NRS resource administration"
      description="Edit locally prepared code options; this does not request or validate an official NRS resource response."
      onClose={() => setResourceDraft(null)} busy={savingResource}
      footer={<><Button variant="secondary" disabled={savingResource} onClick={() => setResourceDraft(null)}>Cancel</Button>
        <Button icon={Save} loading={savingResource} onClick={saveResource}>Save local options</Button></>}>
      {resourceDraft ? <div className={styles.drawerFields}>
        <Alert tone="info">One entry per line: <strong>CODE | Label | Description</strong>. Add <strong>| inactive</strong> to keep a code inactive. Maximum 300 entries. All entries are local and unverified.</Alert>
        <Textarea label="Resource entries" id="firs-resource-entries" rows={14}
          value={resourceDraft.text} onChange={(event) => setResourceDraft((previous) => ({ ...previous, text: event.target.value, error: '' }))}
          error={resourceDraft.error} disabled={savingResource}
          placeholder="VAT_STANDARD | Standard VAT | Standard taxable supply" />
      </div> : null}
    </Drawer>
    <ConfirmDialog open={discardOpen} title="Discard integration changes?"
      message="Your unsaved integration settings and newly entered keys will be cleared."
      variant="danger" confirmLabel="Discard changes" onClose={() => setDiscardOpen(false)} onConfirm={reset} />
  </main>
}
