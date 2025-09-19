import React from 'react';
import { motion } from 'framer-motion';

interface PageLoaderProps {
  message?: string;
  showSpinner?: boolean;
}

export function PageLoader({ 
  message = "Loading...", 
  showSpinner = true 
}: PageLoaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[400px] flex flex-col items-center justify-center p-8"
    >
      <div className="text-center">
        {showSpinner && (
          <div className="mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
          </div>
        )}
        
        <p className="text-lg font-medium text-gray-900 dark:text-white">
          {message}
        </p>
        
        <div className="mt-4 flex justify-center space-x-1">
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
            className="w-2 h-2 bg-indigo-500 rounded-full"
          />
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
            className="w-2 h-2 bg-indigo-500 rounded-full"
          />
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
            className="w-2 h-2 bg-indigo-500 rounded-full"
          />
        </div>
      </div>
    </motion.div>
  );
}
