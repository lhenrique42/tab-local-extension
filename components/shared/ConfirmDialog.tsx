import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import './shared.css';

export interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea',
  'input',
  'select',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Save & restore focus on mount/unmount
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Auto-focus the first focusable element in the dialog
    const firstFocusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)[0];
    firstFocusable?.focus();

    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  // Trap focus within dialog
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      onCancel();
      return;
    }

    if (e.key !== 'Tab') return;

    const focusableEls = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
    );
    if (focusableEls.length === 0) return;

    const first = focusableEls[0];
    const last = focusableEls[focusableEls.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return createPortal(
    <div
      className="tl-dialog-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="tl-dialog-title"
        aria-describedby="tl-dialog-message"
        className="tl-dialog"
        onKeyDown={handleKeyDown}
      >
        <h2 id="tl-dialog-title" className="tl-dialog__title">
          {title}
        </h2>
        <p id="tl-dialog-message" className="tl-dialog__message">
          {message}
        </p>
        <div className="tl-dialog__actions">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
