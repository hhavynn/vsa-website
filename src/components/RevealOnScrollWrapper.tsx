import React from 'react';
import { motion } from 'framer-motion';

interface RevealOnScrollWrapperProps {
  children: React.ReactNode;
}

export const RevealOnScrollWrapper: React.FC<RevealOnScrollWrapperProps> = ({ children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}; 