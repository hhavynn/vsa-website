import { Outlet, useLocation } from 'react-router-dom';
import { NavigationShell } from './navigation/NavigationShell';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { BackToTop } from './BackToTop';
import { MobileQuickDock } from './navigation/MobileQuickDock';
import { Suspense, useEffect } from 'react';
import Footer from './Footer';
import { PageLoader } from '../common/PageLoader';
import { VsaAiAssistant } from '../features/ai/VsaAiAssistant';
import { keepHashTargetInView } from '../../utils/hashScroll';

function ScrollManager() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // No hash: normal behavior — jump to the top on every navigation.
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      return;
    }

    // Home can change height after its async sections resolve, so keep the
    // anchor aligned briefly after it first appears.
    const id = decodeURIComponent(hash.slice(1));
    return keepHashTargetInView(id);
  }, [pathname, search, hash]);

  return null;
}

export function Layout() {
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <ScrollManager />
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
      <MobileQuickDock />
      <VsaAiAssistant />
    </div>
  );
}
