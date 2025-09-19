import React from 'react';
import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
  lines?: number;
  animate?: boolean;
}

export function Skeleton({ 
  className = "h-4 bg-gray-200 dark:bg-gray-700 rounded", 
  lines = 1,
  animate = true 
}: SkeletonProps) {
  const animationProps = animate ? {
    animate: { opacity: [0.5, 1, 0.5] },
    transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
  } : {};

  if (lines === 1) {
    return (
      <motion.div 
        className={className}
        {...animationProps}
      />
    );
  }

  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, index) => (
        <motion.div
          key={index}
          className={className}
          style={{
            width: index === lines - 1 ? '75%' : '100%'
          }}
          {...animationProps}
        />
      ))}
    </div>
  );
}

// Pre-built skeleton components for common use cases
export function EventCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <Skeleton className="h-48 bg-gray-200 dark:bg-gray-700 rounded-md mb-4" />
      <Skeleton className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2" lines={1} />
      <Skeleton className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-4" lines={2} />
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" lines={1} />
        <Skeleton className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20" lines={1} />
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center space-x-4 mb-6">
        <Skeleton className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2" lines={1} />
          <Skeleton className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" lines={1} />
        </div>
      </div>
      <Skeleton className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2" lines={3} />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <Skeleton className="h-6 bg-gray-200 dark:bg-gray-700 rounded" lines={1} />
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="px-6 py-4">
            <div className="flex space-x-4">
              <Skeleton className="h-4 bg-gray-200 dark:bg-gray-700 rounded flex-1" lines={1} />
              <Skeleton className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" lines={1} />
              <Skeleton className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" lines={1} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
