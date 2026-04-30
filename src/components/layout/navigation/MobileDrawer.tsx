import { memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { NavLinks } from './NavLinks';
import { UserMenu } from './UserMenu';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileDrawer = memo(function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.15, ease: 'easeInOut' }}
          className="overflow-hidden border-t border-[var(--border)] md:hidden"
        >
          <div className="bg-[var(--surface)] px-4 py-4">
            <NavLinks isMobile onLinkClick={onClose} />
            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <UserMenu isMobile onLinkClick={onClose} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
