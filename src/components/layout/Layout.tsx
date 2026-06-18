import { Outlet, useLocation } from 'react-router-dom';
import { NavigationShell } from './navigation/NavigationShell';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { BackToTop } from './BackToTop';
import { Suspense, useEffect } from 'react';
import Footer from './Footer';
import { PageLoader } from '../common/PageLoader';
import { VsaAiAssistant } from '../features/ai/VsaAiAssistant';

function ScrollToTop() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (hash || typeof window === 'undefined') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, search, hash]);

  return null;
}

export function Layout() {
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <ScrollToTop />
      <NavigationShell />

      <main id="main-content" className="flex-grow pt-[60px]">
        <Suspense fallback={<PageLoader />}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.15, ease: 'easeInOut' }}
              className="w-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </Suspense>
      </main>

      <Footer />
      <BackToTop />
      <VsaAiAssistant />
    </div>
  );
}
