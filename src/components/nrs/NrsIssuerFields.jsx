import { Fingerprint, Hash, MapPin } from 'lucide-react'
import TextField from '../forms/TextField'

/** Reused issuer identifiers. Optional until NRS issues the IDs; never evidence of approval. */
export default function NrsIssuerFields({ form, errors = {}, onChange, idPrefix = 'issuer' }) {
  const field = (name, label, hint, placeholder, icon, maxLength) => (
    <TextField
      key={name}
      id={`${idPrefix}-${name}`}
      name={name}
      label={label}
      hint={hint}
      placeholder={placeholder}
      icon={icon}
      maxLength={maxLength}
      value={form[name] ?? ''}
      onChange={(event) => onChange(name, event.target.value)}
      error={errors[name]}
      autoComplete="off"
    />
  )
  return <>
    {field('nrs_business_id', 'NRS business ID (issued by NRS)', 'Optional UUID issued by NRS.', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', Fingerprint, 36)}
    {field('nrs_service_id', 'NRS service ID (issued by NRS)', 'Optional 8-character alphanumeric ID.', '8-character service ID', Hash, 8)}
    {field('nrs_postal_zone', 'NRS postal zone', 'Postal code for the issuer address.', 'Postal code', MapPin, 20)}
    {field('nrs_state_code', 'NRS state code', 'Use the applicable NRS resource code.', 'State code from NRS', Hash, 100)}
    {field('nrs_lga_code', 'NRS LGA code', 'Use the applicable NRS resource code.', 'LGA code from NRS', Hash, 100)}
  </>
}
