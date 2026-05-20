import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './shared.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'default' | 'sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: boolean;
  block?: boolean;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'ghost',
  size = 'default',
  icon = false,
  block = false,
  loading = false,
  disabled,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const classes = [
    'tl-btn',
    `tl-btn-${variant}`,
    size === 'sm' ? 'tl-btn-sm' : '',
    icon ? 'tl-btn-icon' : '',
    block ? 'tl-btn-block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="tl-btn-spinner" aria-hidden="true" /> : children}
    </button>
  );
}
