// Invoice line classification is derived from the catalogue by the PHP API at
// save time. The frontend may display snapshots but must never submit them as
// editable payload fields or claim that a code is NRS-verified.
const normalize = (value) => String(value ?? '').trim()

const itemKind = (item) => {
  if (item?.firs_item_type === 'goods' || item?.firs_item_type === 'service') {
    return item.firs_item_type
  }
  return item?.item_type === 'product' ? 'goods' : 'service'
}

export function invoiceLineClassification(line, item) {
  const hasSavedSnapshot = Boolean(line?.has_saved_snapshot)
  const savedType = normalize(line?.firs_item_type_snapshot)
  const savedCode = normalize(line?.nrs_item_classification_snapshot)
  const currentType = item ? itemKind(item) : (savedType || 'service')
  const currentCode = item ? normalize(item.nrs_item_classification_code) : ''
  const changedSinceSave = Boolean(
    item && hasSavedSnapshot &&
    (savedType !== currentType || savedCode.toUpperCase() !== currentCode.toUpperCase()),
  )

  return {
    type: currentType,
    label: currentType === 'goods' ? 'HS goods classification' : 'Service classification',
    code: currentCode,
    hasSavedSnapshot,
    savedType,
    savedCode,
    changedSinceSave,
  }
}
