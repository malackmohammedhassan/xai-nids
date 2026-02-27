import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, X } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  children?: ReactNode;
}

const CONFIRM_CLASSES = {
  danger: 'bg-red-600 hover:bg-red-500 text-white',
  warning: 'bg-yellow-600 hover:bg-yellow-500 text-white',
  info: 'bg-cyan-600 hover:bg-cyan-500 text-white',
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
}: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
          <Dialog.Close className="absolute top-3 right-3 text-gray-500 hover:text-gray-300">
            <X size={16} />
          </Dialog.Close>

          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle size={20} className="mt-0.5 text-yellow-400 shrink-0" />
            <div>
              <Dialog.Title className="text-white font-semibold text-sm">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="text-gray-400 text-sm mt-1">
                  {description}
                </Dialog.Description>
              )}
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Dialog.Close asChild>
              <button className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
                {cancelLabel}
              </button>
            </Dialog.Close>
            <button
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${CONFIRM_CLASSES[variant]}`}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
