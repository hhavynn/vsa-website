import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageTitle } from '../components/common/PageTitle';
import { RevealOnScrollWrapper } from '../components/common/RevealOnScrollWrapper';
import { useAuth } from '../hooks/useAuth';
import { useEvents } from '../hooks/useEvents';
import { usePresidentsContent } from '../hooks/usePresidentsContent';
import { splitPresidentsMessage } from '../data/presidentsContent';
import { EVENT_TYPE_LABELS } from '../constants/eventTypes';
import { format } from 'date-fns';

const pillars = [
  {
    label: 'Social',
    description: 'Build bonds through the ACE Program and House System',
  },
  {
    label: 'Community',
    description: 'A supportive space for Vietnamese and non-Vietnamese students alike',
  },
  {
    label: 'Academic',
    description: 'Prioritize academic growth alongside cultural engagement',
  },
  {
    label: 'Cultural',
    description: 'Celebrate heritage through VCN, Black April, and more',
  },
];

export function Home() {
  const { user } = useAuth();
  const { events, loading: eventsLoading, error: eventsError } = useEvents();
  const { content: presidentsContent } = usePresidentsContent();
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    setCurrentDate(
      new Date().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    );
  }, []);

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const upcomingEvents = events
    .filter(e => new Date(e.date) >= oneDayAgo)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 3);
  const presidentsMessage = splitPresidentsMessage(presidentsContent.message);

  return (
    <>
      <PageTitle title="Home" />

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative min-h-[72vh] flex items-center justify-center bg-zinc-950 border-b border-zinc-800 overflow-hidden">
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-zinc-500 text-xs font-medium tracking-widest uppercase mb-5"
          >
            {currentDate}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="font-bold text-5xl sm:text-6xl md:text-7xl text-zinc-50 mb-6 leading-tight tracking-tight"
          >
            Welcome to{' '}
            <span className="text-brand-500">VSA at UCSD</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="text-zinc-400 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Promoting and preserving Vietnamese culture since 1977 — a home
            for every student at UC San Diego.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap gap-3 justify-center"
          >
            <Link
              to="/events"
              className="px-7 py-3.5 rounded bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition-colors duration-150"
            >
              View Events
            </Link>
            <Link
              to="/get-involved"
              className="px-7 py-3.5 rounded border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-zinc-100 font-semibold text-sm transition-colors duration-150"
            >
              Get Involved
            </Link>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-zinc-600"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.div>
      </section>

      {/* ── Mission + Pillars ──────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-16">
          <RevealOnScrollWrapper>
            <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md p-8 h-full">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight mb-4">Our Mission &amp; History</h2>
              <div className="space-y-4 text-zinc-600 dark:text-zinc-400 leading-relaxed text-sm">
                <p>
                  The Vietnamese Student Association at UC San Diego strives to promote and preserve
                  Vietnamese culture. We provide resources and a safe space for students to unite
                  as a Vietnamese-American community — a nonprofit organization for all.
                </p>
                <p>
                  Established in 1977, VSA at UCSD has grown into an organization that exposes
                  Vietnamese culture through academics, social, cultural, and community events each year.
                </p>
              </div>
            </div>
          </RevealOnScrollWrapper>

          <RevealOnScrollWrapper delay={0.1}>
            <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md p-8 h-full flex flex-col justify-between">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight mb-3">Get Involved</h2>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed mb-6">
                  Come to our events and immerse yourself in Vietnamese culture! Connect with our
                  community and meet cabinet members who are passionate about making you feel at home.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/events"
                  className="px-5 py-2.5 rounded bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors duration-150"
                >
                  Upcoming Events
                </Link>
                {!user && (
                  <Link
                    to="/signin"
                    className="px-5 py-2.5 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm font-semibold transition-colors duration-150"
                  >
                    Member Sign In
                  </Link>
                )}
              </div>
            </div>
          </RevealOnScrollWrapper>
        </div>

        {/* Four Pillars */}
        <RevealOnScrollWrapper>
          <div className="flex items-center gap-4 mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">Our Four Pillars</h2>
            <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </RevealOnScrollWrapper>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {pillars.map((p, i) => (
            <RevealOnScrollWrapper key={p.label} delay={i * 0.08}>
              <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md p-6 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors duration-150">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-2 text-sm">{p.label}</h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs leading-relaxed">{p.description}</p>
              </div>
            </RevealOnScrollWrapper>
          ))}
        </div>
      </section>

      {/* Presidents' Message */}
      <section className="pb-20 px-4 sm:px-6 max-w-7xl mx-auto">
        <RevealOnScrollWrapper>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md overflow-hidden">
            <div className="bg-zinc-100 dark:bg-zinc-950 border-b lg:border-b-0 lg:border-r border-zinc-200 dark:border-zinc-800 p-8 sm:p-10 flex items-center justify-center">
              {presidentsContent.photoUrl ? (
                <img
                  src={presidentsContent.photoUrl}
                  alt={`${presidentsContent.names} presidents`}
                  className="w-full max-w-sm aspect-[4/5] object-cover rounded-md border border-zinc-200 dark:border-zinc-800"
                />
              ) : (
                <div className="w-full max-w-sm aspect-[4/5] border border-dashed border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 flex items-center justify-center">
                  <div className="text-center px-6">
                    <p className="text-4xl font-semibold text-brand-600 mb-3">GN + PL</p>
                    <p className="text-xs font-medium uppercase tracking-label text-zinc-500 dark:text-zinc-500">
                      Presidents Photo
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-8 sm:p-10">
              <p className="text-xs font-medium uppercase tracking-label text-brand-600 dark:text-brand-400 mb-3">
                Presidents
              </p>
              <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight mb-2">
                {presidentsContent.names}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
                {presidentsContent.role}
              </p>

              <div className="space-y-4 text-sm sm:text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
                {presidentsMessage.map((paragraph, index) => (
                  <p
                    key={`${paragraph.slice(0, 24)}-${index}`}
                    className={index === presidentsMessage.length - 1 ? 'text-zinc-700 dark:text-zinc-300 whitespace-pre-line' : 'whitespace-pre-line'}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </RevealOnScrollWrapper>
      </section>

      {/* Upcoming Events */}
      <section className="pb-20 px-4 sm:px-6 max-w-7xl mx-auto">
        <RevealOnScrollWrapper>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">Upcoming Events</h2>
            <Link
              to="/events"
              className="text-brand-600 hover:text-brand-700 dark:text-brand-400 text-sm font-medium transition-colors duration-150"
            >
              View all →
            </Link>
          </div>
        </RevealOnScrollWrapper>

        {eventsLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-brand-600 animate-spin" />
          </div>
        ) : eventsError ? (
          <div className="border border-red-900/40 bg-red-950/20 rounded p-6 text-red-400 text-sm text-center">
            Failed to load events — please try again later.
          </div>
        ) : upcomingEvents.length === 0 ? (
          <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md p-10 text-center">
            <p className="text-zinc-500">No upcoming events at the moment. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingEvents.map((event, i) => (
              <RevealOnScrollWrapper key={event.id} delay={i * 0.08}>
                <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md overflow-hidden hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors duration-150">
                  {event.image_url && (
                    <div className="h-40 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                      <img src={event.image_url} alt={event.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-5">
                    <span className="inline-block px-2 py-0.5 text-xs font-medium border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 rounded mb-3">
                      {EVENT_TYPE_LABELS[event.event_type]}
                    </span>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-1.5 line-clamp-1 text-base">{event.name}</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 text-xs line-clamp-2 mb-3">{event.description}</p>
                    <p className="text-zinc-400 text-xs">
                      {format(new Date(event.date), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              </RevealOnScrollWrapper>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
