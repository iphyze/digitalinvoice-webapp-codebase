/** Strict parsing: never confuse an API error or malformed payload with an empty register. */
export const parseErpClients = (response) => {
  const data = response?.data?.data;
  if (!Array.isArray(data?.clients) || !Array.isArray(data?.allowed_scopes)) {
    throw new Error('The ERP client response was incomplete.');
  }
  return { clients: data.clients, scopes: data.allowed_scopes };
};

export const parseErpWebhooks = (response) => {
  const data = response?.data?.data;
  if (!Array.isArray(data?.endpoints) || !Array.isArray(data?.supported_events)) {
    throw new Error('The webhook configuration response was incomplete.');
  }
  return { endpoints: data.endpoints, events: data.supported_events };
};

export const parseErpDeliveries = (response) => {
  const data = response?.data?.data;
  if (!Array.isArray(data?.deliveries)) throw new Error('The webhook delivery response was incomplete.');
  return { deliveries: data.deliveries, limit: Number(data.limit || 100) };
};

export const parseOneTimeCredential = (response, kind) => {
  const data = response?.data?.data;
  const key = kind === 'client' ? 'client_secret' : 'signing_secret';
  if (!data || typeof data[key] !== 'string' || !data[key]) {
    throw new Error('The server did not return a one-time secret. Check the integration before continuing.');
  }
  if (kind === 'client' && (typeof data.client_id !== 'string' || !data.client_id)) {
    // Rotation does not return a new client identifier; caller must supply the existing identifier.
    return { secret: data[key], clientId: null };
  }
  return { secret: data[key], clientId: kind === 'client' ? data.client_id : null };
};

export const isEnabled = (value) => value === true || value === 1 || value === '1';

export const validateClientForm = (form, validScopes) => {
  const errors = {};
  const name = String(form?.name || '').trim();
  if (!name || name.length > 120) errors.name = 'Enter a name between 1 and 120 characters.';
  if (!Array.isArray(form?.scopes) || form.scopes.length === 0 || form.scopes.some((item) => !validScopes.includes(item))) {
    errors.scopes = 'Select at least one available read-only scope.';
  }
  return errors;
};

export const validateWebhookForm = (form, validEvents) => {
  const errors = {};
  const name = String(form?.name || '').trim();
  if (!form?.id && (!name || name.length > 120)) errors.name = 'Enter a name between 1 and 120 characters.';
  const url = String(form?.url || '').trim();
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password || parsed.port) {
      errors.url = 'Use an HTTPS URL with a public hostname and no credentials or custom port.';
    }
  } catch { errors.url = 'Enter a valid HTTPS destination URL.'; }
  if (!Array.isArray(form?.events) || form.events.length === 0 || form.events.some((item) => !validEvents.includes(item))) {
    errors.events = 'Select at least one supported webhook event.';
  }
  return errors;
};

export const scopeText = (items) => Array.isArray(items) ? items.join(', ') : '—';

export const integrationTime = (value) => {
  if (!value) return '—';
  const date = new Date(String(value).replace(' ', 'T') + (/Z$|[+-]\d\d:\d\d$/.test(String(value)) ? '' : 'Z'));
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

export const createClientPayload = (form) => ({ name: form.name.trim(), scopes: form.scopes });
export const createWebhookPayload = (form) => ({ name: form.name.trim(), url: form.url.trim(), events: form.events });
export const updateWebhookPayload = (form) => ({ id: form.id, action: 'update', url: form.url.trim(), events: form.events });
