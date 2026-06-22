'use client';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  loading?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, message, loading, confirmLabel = 'Confirm', cancelLabel = 'Cancel'
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
