import React from 'react';
import { motion } from 'framer-motion';

interface RevealOnScrollWrapperProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export const RevealOnScrollWrapper: React.FC<RevealOnScrollWrapperProps> = ({
  children,
  delay = 0,
  className,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.5, ease: 'easeOut', delay }}
    className={className}
  >
    {children}
  </motion.div>
);
