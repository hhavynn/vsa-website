import { motion } from 'framer-motion';

interface PageLoaderProps {
  message?: string;
  showSpinner?: boolean;
}

export function PageLoader({ message = 'Loading...', showSpinner = true }: PageLoaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-8"
    >
      {showSpinner && (
        <div className="relative">
          <div className="h-10 w-10 rounded-full border-2 border-slate-700" />
          <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-transparent border-t-indigo-500 animate-spin" />
        </div>
      )}
      <p className="text-slate-400 text-sm font-medium">{message}</p>
      <div className="flex gap-1.5">
        {[0, 0.15, 0.3].map((delay, i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay }}
            className="w-1.5 h-1.5 rounded-full bg-indigo-500"
          />
        ))}
      </div>
    </motion.div>
  );
}
