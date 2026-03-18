import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NavLinks } from './NavLinks';
import { UserMenu } from './UserMenu';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const MobileDrawer = memo(function MobileDrawer({
  isOpen,
  onClose,
  className = '',
}: MobileDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.15, ease: 'easeInOut' }}
          className={`sm:hidden overflow-hidden border-t border-zinc-800 ${className}`}
        >
          <div className="bg-zinc-950 px-4 py-3">
            <NavLinks isMobile onLinkClick={onClose} />
            <div className="mt-3 pt-3 border-t border-zinc-800">
              <UserMenu isMobile onLinkClick={onClose} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
