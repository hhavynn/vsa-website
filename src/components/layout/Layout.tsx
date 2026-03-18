import { Outlet, useLocation } from 'react-router-dom';
import { NavigationShell } from './navigation/NavigationShell';
import { motion, AnimatePresence } from 'framer-motion';
import { BackToTop } from './BackToTop';
import { Suspense } from 'react';
import Footer from './Footer';
import { PageLoader } from '../common/PageLoader';
import { ThemeToggle } from './ThemeToggle';

export function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 flex flex-col font-sans">
      <NavigationShell />

      <main id="main-content" className="flex-grow">
        <Suspense fallback={<PageLoader />}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease: 'easeInOut' }}
              className="w-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </Suspense>
      </main>

      <Footer />
      <BackToTop />
      <ThemeToggle />
    </div>
  );
}
