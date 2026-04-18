'use client';

/**
 * @file confirm-dialog.tsx
 * @description Confirmation dialog for destructive actions.
 */

import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from './modal';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  isLoading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal title="" onClose={onCancel} size="sm">
      <div className="text-center space-y-4 pt-2">
        <div className="w-12 h-12 bg-red-50 dark:bg-red-950 rounded-2xl flex items-center justify-center mx-auto">
          <AlertTriangle className="text-red-500" size={22} />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
          <p className="text-sm text-[#708a83] mt-1">{message}</p>
        </div>
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1 border-[#dfdfe2]"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}