import type { ToasterProps } from 'react-hot-toast';

/**
 * Shared toast styling. Toasts portal outside every layout, so they read the
 * theme tokens directly; App's Toaster is the only one mounted and passes
 * this, so no toast falls back to the library's white default.
 */
export const TOAST_OPTIONS: ToasterProps['toastOptions'] = {
  style: {
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    boxShadow: '0 12px 32px rgba(22, 30, 61, 0.16)',
    fontFamily: '"DM Sans", system-ui, sans-serif',
    fontSize: '13px',
  },
  success: { iconTheme: { primary: '#4356a1', secondary: '#ffffff' } },
};
