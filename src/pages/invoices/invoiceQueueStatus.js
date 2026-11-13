/**
 * Read-only NRS reporting queue data. This endpoint covers all organisation
 * overdue B2C jobs, but only returns the 100 latest individual queue records.
 * It is a local dry-run queue, never evidence of NRS submission or clearance.
 */
export function readInvoiceQueue(response) {
  const data = response?.data?.data
  const count = Number(data?.b2c_overdue_count)
  if (!Array.isArray(data?.jobs) || !Number.isSafeInteger(count) || count < 0 ||
    data?.mode !== 'dry_run' || data?.external_submission_enabled !== false) {
    throw new Error('Unexpected response from the NRS reporting queue.')
  }

  const jobsByInvoice = new Map()
  // Backend sorts the jobs newest first. Do not overwrite a newer job with an
  // older one if more than one queue record exists for the same invoice.
  for (const job of data.jobs) {
    const invoiceId = Number(job?.invoice_id)
    if (Number.isSafeInteger(invoiceId) && invoiceId > 0 && !jobsByInvoice.has(invoiceId)) {
      jobsByInvoice.set(invoiceId, job)
    }
  }
  return { overdueCount: count, jobsByInvoice }
}

export const localQueueState = (job) => {
  const state = String(job?.status || '').trim().toLowerCase()
  return ({
    pending: 'Pending', processing: 'Processing', failed: 'Retry pending',
    dead: 'Retries exhausted', cancelled: 'Cancelled', submitted: 'Marked submitted',
  })[state] || 'Unknown'
}

export function invoiceQueuePresentation(invoice, snapshot, loading, error) {
  if (invoice?.status !== 'approved') {
    return { label: 'After approval', tone: 'neutral', detail: 'Not yet eligible for the approval queue.' }
  }
  if (loading) return { label: 'Checking queue', tone: 'neutral' }
  if (error || !snapshot) return { label: 'Queue unavailable', tone: 'neutral' }

  const job = snapshot.jobsByInvoice.get(Number(invoice.id))
  if (!job) {
    return { label: 'Not in recent queue', tone: 'neutral', detail: 'The API shows only the latest 100 jobs; this is not proof that no job exists.' }
  }
  const isB2c = job.invoice_kind === 'b2c'
  const overdue = isB2c && Number(job.is_overdue) === 1
  const status = String(job.status || '').toLowerCase()
  const exceptional = ['failed', 'dead'].includes(status)
  const ended = ['cancelled', 'submitted'].includes(status)
  const label = overdue ? 'B2C overdue' : ended ? `Local: ${localQueueState(job)}`
    : exceptional ? 'Queue needs attention' : isB2c ? 'B2C reporting' : 'B2B clearance'
  const tone = overdue || exceptional ? 'danger' : ended ? 'neutral' : 'warning'
  return {
    label,
    tone,
    detail: `Internal: ${localQueueState(job)}${job.dry_run_at ? ' · Dry-run preview recorded' : ' · No dry-run preview recorded'}`,
    // A SQL DATETIME has no timezone: show it as server-local without letting
    // the browser reinterpret it using the viewer's local timezone.
    deadline: isB2c && typeof job.due_at === 'string' && job.due_at.trim()
      ? `24-hour deadline: ${job.due_at.trim()} (server time)` : '',
  }
}
