'use client';
// src/components/ui/ConfirmDialog.tsx

import Modal  from './Modal';
import Button from './Button';

interface ConfirmDialogProps {
  open:        boolean;
  onClose:     () => void;
  onConfirm:   () => void;
  title:       string;
  description: string;
  confirmLabel?: string;
  variant?:    'danger' | 'primary';
  loading?:    boolean;
}

export default function ConfirmDialog({
  open, onClose, onConfirm, title, description,
  confirmLabel = 'Confirm', variant = 'danger', loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="sm">
      <p className="text-sm text-gray-600 mb-5">{description}</p>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant={variant} size="sm" onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
