import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CabinetRoleDescription } from '../../../data/repos/cabinetRolesRepository';

interface CabinetRoleModalProps {
  isOpen: boolean;
  role: CabinetRoleDescription | null;
  onClose: () => void;
}

export function CabinetRoleModal({ isOpen, role, onClose }: CabinetRoleModalProps) {
  const modalRef = React.useRef<HTMLDivElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  // Handle escape key and focus management
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Small delay to allow Framer Motion to mount the DOM element
      setTimeout(() => {
        modalRef.current?.focus();
      }, 50);
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !role) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6 pointer-events-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />

        <motion.div
          ref={modalRef}
          tabIndex={-1}
          initial={{ opacity: 0, y: 100, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto bg-surface border border-border-strong rounded-2xl shadow-2xl z-10 flex flex-col focus:outline-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="role-modal-title"
        >
          {/* Header */}
          <div className="sticky top-0 bg-surface/95 backdrop-blur z-10 p-5 sm:p-6 border-b border-border-subtle flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-brand-600 dark:text-brand-400 mb-1">
                {role.board_group}
              </p>
              <h2 id="role-modal-title" className="text-2xl font-bold text-text-primary">
                {role.role_name}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 -mr-2 -mt-2 text-text-tertiary hover:text-text-primary bg-surface2/50 hover:bg-surface2 rounded-full transition-colors"
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-5 sm:p-6 space-y-6">
            <p className="text-text-secondary leading-relaxed text-lg">
              {role.short_description}
            </p>

            {role.responsibilities && role.responsibilities.length > 0 && (
              <section>
                <h3 className="text-sm font-bold uppercase tracking-wider text-text-tertiary mb-3">
                  Core Responsibilities
                </h3>
                <ul className="space-y-2">
                  {role.responsibilities.map((resp, i) => (
                    <li key={i} className="flex gap-3 text-text-secondary">
                      <span className="text-brand-500 mt-1 shrink-0">•</span>
                      <span>{resp}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {role.works_with && role.works_with.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-text-tertiary mb-3">
                    Collaborates With
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {role.works_with.map((group, i) => (
                      <span key={i} className="px-3 py-1 bg-surface2 text-text-secondary text-sm rounded-full border border-border-subtle">
                        {group}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {role.best_fit_for && role.best_fit_for.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-text-tertiary mb-3">
                    Ideal Candidate
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {role.best_fit_for.map((trait, i) => (
                      <span key={i} className="px-3 py-1 bg-surface2 text-text-secondary text-sm rounded-full border border-border-subtle">
                        {trait}
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
