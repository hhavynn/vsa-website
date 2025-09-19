import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { NavLinks } from './NavLinks';
import { UserMenu } from './UserMenu';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const MobileDrawer = memo(function MobileDrawer({ isOpen, onClose, className = '' }: MobileDrawerProps) {
  const { theme } = useTheme();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className={`sm:hidden ${className}`}
        >
          <div className={`pt-2 pb-3 space-y-1 ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
            <NavLinks isMobile={true} onLinkClick={onClose} />
          </div>

          {/* Mobile User Menu */}
          <div className={`pt-4 pb-3 border-t ${theme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
            <UserMenu isMobile={true} onLinkClick={onClose} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
