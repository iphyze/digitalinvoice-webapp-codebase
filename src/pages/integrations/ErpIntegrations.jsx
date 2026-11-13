import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Check, ClipboardCopy, Download, KeyRound, Plus, RefreshCw, Webhook,
} from 'lucide-react';
import PageHeader from '../../components/shell/PageHeader';
import PageLoader from '../../components/ui/PageLoader';
import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/ui/StatusBadge';
import DataTable from '../../components/data/DataTable';
import TextField from '../../components/forms/TextField';
import Checkbox from '../../components/forms/Checkbox';
import Modal from '../../components/overlays/Modal';
import ConfirmDialog from '../../components/overlays/ConfirmDialog';
import erpIntegrationService from '../../services/erpIntegrationService';
import useToastStore from '../../stores/useToastStore';
import { getErrorMessage } from '../../utils/httpError';
import {
  parseErpClients, parseErpWebhooks, parseErpDeliveries, parseOneTimeCredential,
  isEnabled, validateClientForm, validateWebhookForm, scopeText, integrationTime,
  createClientPayload, createWebhookPayload, updateWebhookPayload,
} from './erpIntegrationModel';
import styles from './ErpIntegrations.module.css';

const TABS = [
  { id: 'clients', label: 'API clients', icon: KeyRound },
  { id: 'webhooks', label: 'Webhook endpoints', icon: Webhook },
  { id: 'deliveries', label: 'Delivery history', icon: Activity },
];

const blankClient = () => ({ name: '', scopes: [] });
const blankWebhook = () => ({ name: '', url: '', events: [] });

function ToggleOptions({ title, values, selected, onChange, disabled }) {
  return <fieldset className={styles.optionSet} disabled={disabled}>
    <legend>{title}</legend>
    <div className={styles.optionGrid}>
      {values.map((value) => <Checkbox key={value} label={value.replaceAll('_', ' ')} description={value}
        checked={selected.includes(value)} onChange={(event) => onChange(event.target.checked
          ? [...selected, value] : selected.filter((item) => item !== value))} />)}
    </div>
  </fieldset>;
}

function ErrorMessage({ message, retry }) {
  return message ? <Alert tone="danger" title="Unable to load integration data">
    {message} {retry ? <Button size="sm" variant="secondary" onClick={retry}>Try again</Button> : null}
  </Alert> : null;
}

function Empty({ title, children }) {
  return <div className={styles.empty}><h3>{title}</h3><p>{children}</p></div>;
}

export default function ErpIntegrations() {
  const toast = useToastStore((state) => state.showToast);
  const [tab, setTab] = useState('clients');
  const [clients, setClients] = useState([]);
  const [scopes, setScopes] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [events, setEvents] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loaded, setLoaded] = useState({});
  const [loading, setLoading] = useState('');
  const [error, setError] = useState({});
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState(null);
  const [fields, setFields] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [oneTime, setOneTime] = useState(null);
  const [secretAcknowledged, setSecretAcknowledged] = useState(false);

  const load = useCallback(async (section) => {
    setLoading(section);
    setError((old) => ({ ...old, [section]: '' }));
    try {
      if (section === 'clients') {
        const result = parseErpClients(await erpIntegrationService.clients());
        setClients(result.clients);
        setScopes(result.scopes);
      } else if (section === 'webhooks') {
        const result = parseErpWebhooks(await erpIntegrationService.webhooks());
        setEndpoints(result.endpoints);
        setEvents(result.events);
      } else {
        const result = parseErpDeliveries(await erpIntegrationService.deliveries());
        setDeliveries(result.deliveries);
      }
      setLoaded((old) => ({ ...old, [section]: true }));
    } catch (cause) {
      setError((old) => ({ ...old, [section]: getErrorMessage(cause, 'Unable to load ERP integration information.') }));
    } finally { setLoading(''); }
  }, []);

  useEffect(() => { if (!loaded[tab] && !loading && !error[tab]) load(tab); }, [tab, loaded, loading, error, load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = tab === 'clients' ? clients : tab === 'webhooks' ? endpoints : deliveries;
    if (!needle) return rows;
    return rows.filter((row) => Object.values(row).some((value) =>
      (Array.isArray(value) ? value.join(' ') : String(value ?? '')).toLowerCase().includes(needle)));
  }, [tab, query, clients, endpoints, deliveries]);

  const chooseTab = (section) => { if (oneTime || busy) return; setTab(section); setQuery(''); };
  const startClient = (item = null) => { setEditor({ kind: 'client', ...blankClient(), ...(item ? { id: item.id, name: item.name, scopes: [...(item.scopes || [])] } : {}) }); setFields({}); setSubmitError(''); };
  const startWebhook = (item = null) => { setEditor({ kind: 'webhook', ...blankWebhook(), ...(item ? { id: item.id, name: item.name, url: item.destination_url, events: [...(item.events || [])] } : {}) }); setFields({}); setSubmitError(''); };
  const updateEditor = (key, value) => { setEditor((old) => ({ ...old, [key]: value })); setFields((old) => ({ ...old, [key]: '' })); setSubmitError(''); };

  const presentCredential = (result, kind, clientId = null) => {
    const parsed = parseOneTimeCredential(result, kind);
    setOneTime({ kind, secret: parsed.secret, clientId: parsed.clientId || clientId });
    setSecretAcknowledged(false);
  };
  const closeOneTime = () => { if (!secretAcknowledged) return; setOneTime(null); setSecretAcknowledged(false); };
  const copySecret = async (value) => {
    try { await navigator.clipboard.writeText(value); toast('Copied securely. Store it in your password manager.', 'success'); }
    catch { toast('Clipboard access was blocked. Select the secret and copy it manually.', 'error'); }
  };
  const downloadSecret = () => {
    if (!oneTime) return;
    const text = oneTime.kind === 'client'
      ? `DigitalInvoice ERP OAuth client\nClient ID: ${oneTime.clientId}\nClient secret: ${oneTime.secret}\n`
      : `DigitalInvoice ERP webhook signing secret\nSigning secret: ${oneTime.secret}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = oneTime.kind === 'client' ? 'digitalinvoice-erp-client-credentials.txt' : 'digitalinvoice-webhook-secret.txt';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!editor || busy) return;
    const invalid = editor.kind === 'client' ? validateClientForm(editor, scopes) : validateWebhookForm(editor, events);
    setFields(invalid);
    if (Object.keys(invalid).length) return;
    setBusy(true);
    setSubmitError('');
    try {
      if (editor.kind === 'client') {
        if (editor.id) {
          await erpIntegrationService.updateClient({ id: editor.id, action: 'update_scopes', scopes: editor.scopes });
          toast('Scopes updated. Existing access tokens were revoked.', 'success');
        } else {
          const result = await erpIntegrationService.createClient(createClientPayload(editor));
          presentCredential(result, 'client');
        }
        await load('clients');
      } else {
        if (editor.id) {
          await erpIntegrationService.updateWebhook(updateWebhookPayload(editor));
          toast('Webhook endpoint updated.', 'success');
        } else {
          const result = await erpIntegrationService.createWebhook(createWebhookPayload(editor));
          presentCredential(result, 'webhook');
        }
        await load('webhooks');
      }
      setEditor(null);
    } catch (cause) { setSubmitError(getErrorMessage(cause, 'Unable to save the integration.')); }
    finally { setBusy(false); }
  };

  const act = async () => {
    if (!confirm || busy) return;
    setBusy(true);
    setSubmitError('');
    try {
      if (confirm.kind === 'client') {
        const result = await erpIntegrationService.updateClient({ id: confirm.id, action: confirm.action });
        if (confirm.action === 'rotate_secret') presentCredential(result, 'client', confirm.clientId);
        else toast('ERP client revoked. Existing tokens can no longer be used.', 'success');
        await load('clients');
      } else {
        const result = await erpIntegrationService.updateWebhook({ id: confirm.id, action: confirm.action });
        if (confirm.action === 'rotate_secret') presentCredential(result, 'webhook');
        else toast('Webhook endpoint disabled and pending deliveries cancelled.', 'success');
        await load('webhooks');
      }
      setConfirm(null);
    } catch (cause) { setSubmitError(getErrorMessage(cause, 'The integration could not be updated.')); }
    finally { setBusy(false); }
  };

  const clientColumns = [
    { key: 'name', header: 'Client', cell: (r) => <div className={styles.stack}><strong>{r.name}</strong><span className="ref">{r.client_identifier}</span></div> },
    { key: 'scopes', header: 'Scopes', cell: (r) => <span className={styles.smallText}>{scopeText(r.scopes)}</span> },
    { key: 'is_active', header: 'Status', cell: (r) => <StatusBadge status={isEnabled(r.is_active) && !r.revoked_at ? 'active' : 'revoked'} /> },
    { key: 'last_used_at', header: 'Last used', cell: (r) => integrationTime(r.last_used_at) },
  ];
  const webhookColumns = [
    { key: 'name', header: 'Webhook', cell: (r) => <div className={styles.stack}><strong>{r.name}</strong><span className={styles.breakText}>{r.destination_url}</span></div> },
    { key: 'events', header: 'Events', cell: (r) => <span className={styles.smallText}>{scopeText(r.events)}</span> },
    { key: 'is_active', header: 'Status', cell: (r) => <StatusBadge status={isEnabled(r.is_active) ? 'active' : 'disabled'} /> },
    { key: 'created_at', header: 'Created', cell: (r) => integrationTime(r.created_at) },
  ];
  const deliveryColumns = [
    { key: 'id', header: 'Delivery', cell: (r) => <div className={styles.stack}><span className="ref">#{r.id}</span><span>{r.event_type}</span></div> },
    { key: 'endpoint_id', header: 'Endpoint ID', cell: (r) => <span className="num">#{r.endpoint_id}</span> },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    { key: 'attempt_count', header: 'Attempts', cell: (r) => <span className="num">{r.attempt_count}</span> },
    { key: 'last_http_status', header: 'HTTP', cell: (r) => <span className="num">{r.last_http_status || '—'}</span> },
    { key: 'next_attempt_at', header: 'Next attempt', cell: (r) => integrationTime(r.next_attempt_at) },
    { key: 'last_error', header: 'Last error', cell: (r) => <span className={styles.smallText}>{r.last_error || '—'}</span> },
  ];
  const clientActions = (r) => isEnabled(r.is_active) && !r.revoked_at ? <div className={styles.rowActions}>
    <Button size="sm" variant="secondary" onClick={() => startClient(r)}>Edit scopes</Button>
    <Button size="sm" variant="secondary" onClick={() => { setConfirm({ kind: 'client', action: 'rotate_secret', id: r.id, name: r.name, clientId: r.client_identifier }); setSubmitError(''); }}>Rotate</Button>
    <Button size="sm" variant="danger" onClick={() => { setConfirm({ kind: 'client', action: 'revoke', id: r.id, name: r.name }); setSubmitError(''); }}>Revoke</Button>
  </div> : null;
  const webhookActions = (r) => isEnabled(r.is_active) ? <div className={styles.rowActions}>
    <Button size="sm" variant="secondary" onClick={() => startWebhook(r)}>Edit</Button>
    <Button size="sm" variant="secondary" onClick={() => { setConfirm({ kind: 'webhook', action: 'rotate_secret', id: r.id, name: r.name }); setSubmitError(''); }}>Rotate</Button>
    <Button size="sm" variant="danger" onClick={() => { setConfirm({ kind: 'webhook', action: 'disable', id: r.id, name: r.name }); setSubmitError(''); }}>Disable</Button>
  </div> : null;

  return <main className={styles.page}>
    <PageHeader eyebrow="Workspace administration" title="ERP integrations"
      description="Connect external accounting and ERP systems using scoped, read-only API access and signed event notifications."
      actions={<div className={styles.rowActions}>
        <Button variant="secondary" icon={RefreshCw} disabled={Boolean(loading) || busy || Boolean(oneTime)} onClick={() => load(tab)}>Refresh</Button>
        {tab === 'clients' && <Button icon={Plus} disabled={Boolean(loading) || !loaded.clients} onClick={() => startClient()}>Create API client</Button>}
        {tab === 'webhooks' && <Button icon={Plus} disabled={Boolean(loading) || !loaded.webhooks} onClick={() => startWebhook()}>Add webhook</Button>}
      </div>}
    />
    <Alert title="Integration access is separate from NRS" tone="info">
      These integrations synchronise data with your workspace. They cannot create official NRS evidence, submit tax invoices to NRS or enable production clearance. Server feature flags control token issuance and webhook delivery.
    </Alert>
    <nav className={styles.tabs} aria-label="ERP integration sections">
      {TABS.map(({ id, label, icon: Icon }) => <button type="button" key={id}
        className={styles.tab} data-active={tab === id || undefined} aria-current={tab === id ? 'page' : undefined}
        onClick={() => chooseTab(id)} disabled={busy || Boolean(oneTime)}>
        <Icon size={17} aria-hidden="true" />{label}
      </button>)}
    </nav>
    <section className={styles.panel} aria-label={TABS.find((item) => item.id === tab)?.label}>
      <div className={styles.panelHead}>
        <div><h2>{TABS.find((item) => item.id === tab)?.label}</h2>
          <p>{tab === 'clients' ? 'Credentials and scopes for external read-only API access. Secrets are visible only when created or rotated.'
            : tab === 'webhooks' ? 'HTTPS destinations for signed, at-least-once event notifications.'
              : 'Latest 100 delivery attempts only. Retries are handled by the server-side scheduled dispatcher.'}</p></div>
      </div>
      <ErrorMessage message={error[tab]} retry={() => load(tab)} />
      {loading === tab && !loaded[tab] ? <PageLoader inline message="Loading integrations…" /> : null}
      {loaded[tab] && <>
        <div className={styles.filters}><TextField label={`Search ${tab === 'clients' ? 'API clients' : tab === 'webhooks' ? 'webhooks' : 'deliveries'}`}
          value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search loaded records" />
          <span className={styles.count}>{filtered.length} of {tab === 'clients' ? clients.length : tab === 'webhooks' ? endpoints.length : deliveries.length} loaded records</span></div>
        <DataTable columns={tab === 'clients' ? clientColumns : tab === 'webhooks' ? webhookColumns : deliveryColumns}
          rows={filtered} loading={loading === tab} minWidth={tab === 'deliveries' ? 940 : 720}
          actions={tab === 'clients' ? clientActions : tab === 'webhooks' ? webhookActions : undefined}
          empty={<Empty title={`No ${tab === 'clients' ? 'API clients' : tab === 'webhooks' ? 'webhook endpoints' : 'deliveries'} found`}>
            {query ? 'Try another search.' : tab === 'deliveries' ? 'Delivery history will appear after events are queued and processed.' : 'Create a new integration to get started.'}
          </Empty>} />
        <p className={styles.limitNote}>{tab === 'deliveries' ? 'The backend returns the most recent 100 deliveries, not the full delivery history.' : 'The backend returns up to 100 records. This is not a complete historical count.'}</p>
      </>}
    </section>

    <Modal open={Boolean(editor)} onClose={() => !busy && setEditor(null)} size="lg" busy={busy}
      title={editor?.kind === 'client' ? editor?.id ? 'Edit API client scopes' : 'Create API client' : editor?.id ? 'Edit webhook' : 'Add webhook'}
      description={editor?.kind === 'client' ? 'Grant only the data scopes the external ERP requires.' : 'The endpoint must be public, HTTPS, and accept signed JSON webhooks.'}
      footer={<div className={styles.footer}><Button variant="secondary" disabled={busy} onClick={() => setEditor(null)}>Cancel</Button>
        <Button type="submit" form="erp-integration-form" loading={busy}>Save integration</Button></div>}>
      {editor && <form id="erp-integration-form" className={styles.form} onSubmit={save} noValidate>
        <TextField label="Name" value={editor.name} maxLength={120} disabled={Boolean(editor.id) || busy}
          onChange={(event) => updateEditor('name', event.target.value)} error={fields.name} required />
        {editor.kind === 'client' ? <>
          <ToggleOptions title="Read-only API scopes" values={scopes} selected={editor.scopes}
            disabled={busy} onChange={(value) => updateEditor('scopes', value)} />
          {fields.scopes && <p className={styles.errorText} role="alert">{fields.scopes}</p>}
          {editor.id && <Alert tone="warning">Changing scopes immediately revokes every existing access token for this client.</Alert>}
        </> : <>
          <TextField label="Destination URL" value={editor.url} type="url" placeholder="https://erp.example.com/webhooks"
            onChange={(event) => updateEditor('url', event.target.value)} error={fields.url} disabled={busy} required />
          <ToggleOptions title="Subscribed events" values={events} selected={editor.events}
            disabled={busy} onChange={(value) => updateEditor('events', value)} />
          {fields.events && <p className={styles.errorText} role="alert">{fields.events}</p>}
          <Alert tone="info">URL validation includes a server-side public DNS check. A registered endpoint is not proof that webhook delivery is enabled or working.</Alert>
        </>}
        {submitError && <Alert tone="danger">{submitError}</Alert>}
      </form>}
    </Modal>

    <ConfirmDialog open={Boolean(confirm)} onClose={() => !busy && setConfirm(null)} onConfirm={act} loading={busy}
      title={confirm?.action === 'rotate_secret' ? 'Rotate signing credentials?' : confirm?.action === 'revoke' ? 'Revoke API client?' : 'Disable webhook?'}
      variant={confirm?.action === 'rotate_secret' ? 'primary' : 'danger'}
      confirmLabel={confirm?.action === 'rotate_secret' ? 'Rotate secret' : confirm?.action === 'revoke' ? 'Revoke client' : 'Disable webhook'}
      message={confirm ? `${confirm.name}: ${confirm.action === 'rotate_secret'
        ? 'The old secret will immediately stop working. Save the new one before closing the next screen.'
        : confirm.kind === 'client' ? 'Existing access tokens will be revoked. This cannot be undone.'
          : 'Pending deliveries will be cancelled. This endpoint cannot be re-enabled from this API.'}` : ''} />
    {confirm && submitError && <Alert tone="danger">{submitError}</Alert>}

    <Modal open={Boolean(oneTime)} onClose={closeOneTime} size="lg" busy={!secretAcknowledged}
      title={oneTime?.kind === 'client' ? 'Save your API client credentials' : 'Save your webhook signing secret'}
      description="These values are shown only once. They cannot be retrieved later from the API."
      footer={<div className={styles.footer}><Button disabled={!secretAcknowledged} onClick={closeOneTime} icon={Check}>I have saved the secret</Button></div>}>
      {oneTime && <div className={styles.form}>
        <Alert tone="warning" title="One-time secret">Save the secret in your organisation's password manager. Do not paste it into tickets, emails or source code.</Alert>
        {oneTime.clientId && <div className={styles.secretBlock}><strong>Client ID</strong><code className="ref">{oneTime.clientId}</code>
          <Button size="sm" variant="secondary" icon={ClipboardCopy} onClick={() => copySecret(oneTime.clientId)}>Copy client ID</Button></div>}
        <div className={styles.secretBlock}><strong>{oneTime.kind === 'client' ? 'Client secret' : 'Webhook signing secret'}</strong>
          <code className={styles.secret}>{oneTime.secret}</code>
          <div className={styles.rowActions}><Button size="sm" variant="secondary" icon={ClipboardCopy} onClick={() => copySecret(oneTime.secret)}>Copy secret</Button>
            <Button size="sm" variant="secondary" icon={Download} onClick={downloadSecret}>Download text file</Button></div></div>
        <Checkbox checked={secretAcknowledged} onChange={(event) => setSecretAcknowledged(event.target.checked)}
          label="I have saved this secret securely" description="After you close this window, it will no longer be shown." />
      </div>}
    </Modal>
  </main>;
}
