import Button from '../ui/Button'
import Modal from './Modal'

/** Confirmation built on Modal. variant 'danger' makes the confirm button red. */
export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'primary',
  loading = false, onConfirm, onClose,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={message}
      size="sm"
      busy={loading}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading} data-autofocus>{cancelLabel}</Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      )}
    />
  )
}
