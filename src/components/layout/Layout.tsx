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
import { PublicSearchProvider } from '../features/search/PublicSearchProvider';
import { EDITORIAL_SHELL_CLASS, isPublicEditorialRoute, useEditorialBodyScope } from './publicEditorialTheme';
import '../../styles/public-editorial.css';

function ScrollManager() {
  const { pathname, search, hash, state } = useLocation();
  // An in-page filter change (e.g. /events ?type=) marks its navigation so the
  // reader stays where they are.
  const keepScroll = (state as { keepScroll?: boolean } | null)?.keepScroll === true;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (keepScroll) return;

    // No hash: normal behavior — jump to the top on every navigation.
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      return;
    }

    // Home can change height after its async sections resolve, so keep the
    // anchor aligned briefly after it first appears.
    const id = decodeURIComponent(hash.slice(1));
    return keepHashTargetInView(id);
  }, [pathname, search, hash, keepScroll]);

  return null;
}

function LayoutShell() {
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();
  const editorial = isPublicEditorialRoute(location.pathname);
  useEditorialBodyScope(editorial);

  return (
    <div className={`min-h-screen flex flex-col font-sans${editorial ? ` ${EDITORIAL_SHELL_CLASS}` : ''}`} style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <ScrollManager />
      <header>
        <NavigationShell />
      </header>

      {/* min-h-screen keeps the (tall, mobile) footer below the fold while a route
          chunk or data skeleton is showing, so it does not jump when content lands. */}
      <main id="main-content" className="flex-grow min-h-screen pt-[60px]">
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

export function Layout() {
  return (
    <PublicSearchProvider>
      <LayoutShell />
    </PublicSearchProvider>
  );
}
