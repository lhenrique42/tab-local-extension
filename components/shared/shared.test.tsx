import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { ConfirmDialog } from './ConfirmDialog';
import { Icon } from './Icon';

// ── ConfirmDialog ──────────────────────────────────────────────────────────

describe('ConfirmDialog', () => {
  const defaultProps = {
    title: 'Delete collection',
    message: 'This cannot be undone.',
    confirmLabel: 'Delete',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders title and message correctly', () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Delete collection')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Escape key is pressed', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    const dialog = screen.getByRole('alertdialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('traps focus within the dialog (Tab wraps to first focusable)', async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    // Focus last button and tab — should wrap to first
    buttons[buttons.length - 1].focus();
    await user.tab();
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('passes axe accessibility checks', async () => {
    const { container } = render(<ConfirmDialog {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ── Button ─────────────────────────────────────────────────────────────────

describe('Button', () => {
  it('renders in primary variant', () => {
    const { container } = render(<Button variant="primary">Save</Button>);
    expect(container.firstChild).toHaveClass('tl-btn--primary');
  });

  it('renders in ghost variant', () => {
    const { container } = render(<Button variant="ghost">Cancel</Button>);
    expect(container.firstChild).toHaveClass('tl-btn--ghost');
  });

  it('renders in danger variant', () => {
    const { container } = render(<Button variant="danger">Delete</Button>);
    expect(container.firstChild).toHaveClass('tl-btn--danger');
  });

  it('shows loading spinner when loading={true}', () => {
    render(<Button loading>Saving…</Button>);
    expect(document.querySelector('.tl-btn__spinner')).toBeInTheDocument();
    // Children not visible during loading
    expect(screen.queryByText('Saving…')).not.toBeInTheDocument();
  });

  it('is disabled when loading', () => {
    render(<Button loading>Saving</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('passes axe accessibility checks', async () => {
    const { container } = render(<Button variant="primary">Save</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ── EmptyState ─────────────────────────────────────────────────────────────

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="No sessions" description="Save your first session to get started." />);
    expect(screen.getByText('No sessions')).toBeInTheDocument();
    expect(screen.getByText('Save your first session to get started.')).toBeInTheDocument();
  });

  it('renders without description when not provided', () => {
    render(<EmptyState title="Empty" />);
    expect(screen.getByText('Empty')).toBeInTheDocument();
  });

  it('renders optional action node', () => {
    render(<EmptyState title="Empty" action={<button>Create one</button>} />);
    expect(screen.getByRole('button', { name: 'Create one' })).toBeInTheDocument();
  });

  it('passes axe accessibility checks', async () => {
    const { container } = render(
      <EmptyState title="No sessions" description="Create a new session to get started." />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ── Icon ───────────────────────────────────────────────────────────────────

describe('Icon', () => {
  it('renders an SVG for a known icon name', () => {
    const { container } = render(<Icon name="search" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('respects the size prop', () => {
    const { container } = render(<Icon name="plus" size={24} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
  });
});
