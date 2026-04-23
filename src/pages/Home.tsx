import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageTitle } from '../components/common/PageTitle';
import { RevealOnScrollWrapper } from '../components/common/RevealOnScrollWrapper';
import { useAuth } from '../hooks/useAuth';
import { useEvents } from '../hooks/useEvents';
import { EVENT_TYPE_LABELS } from '../constants/eventTypes';
import { format } from 'date-fns';
import { splitEventsByDate } from '../lib/events';

const pillars = [
  {
    icon: '🤝',
    label: 'Social',
    description: 'Build bonds through the ACE Program and House System',
  },
  {
    icon: '🌏',
    label: 'Community',
    description: 'A supportive space for Vietnamese and non-Vietnamese students alike',
  },
  {
    icon: '📚',
    label: 'Academic',
    description: 'Prioritize academic growth alongside cultural engagement',
  },
  {
    icon: '🎭',
    label: 'Cultural',
    description: 'Celebrate heritage through VCN, Black April, and more',
  },
];

export function Home() {
  const { user } = useAuth();
  const { events, loading: eventsLoading, error: eventsError } = useEvents();
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

  const upcomingEvents = splitEventsByDate(events).upcomingEvents.slice(0, 3);

  return (
    <>
      <PageTitle title="Home" />

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative min-h-[75vh] flex items-center justify-center overflow-hidden">
        {/* Background gradient mesh */}
        <div className="absolute inset-0 hero-gradient" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.35),transparent)]" />

        {/* Floating orbs */}
        <motion.div
          animate={{ y: [0, -20, 0], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none"
        />
        <motion.div
          animate={{ y: [0, 20, 0], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-violet-600/10 blur-3xl pointer-events-none"
        />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-slate-400 text-sm font-medium tracking-widest uppercase mb-4"
          >
            {currentDate}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="font-heading font-extrabold text-5xl sm:text-6xl md:text-7xl text-white mb-6 leading-tight"
          >
            Welcome to{' '}
            <span className="text-gradient">VSA at UCSD</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="text-slate-300 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Promoting and preserving Vietnamese culture since 1977 — a home
            for every student at UC San Diego.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap gap-3 justify-center"
          >
            <Link
              to="/events"
              className="px-7 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-glow transition-all duration-150"
            >
              View Events
            </Link>
            <Link
              to="/get-involved"
              className="px-7 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-semibold text-sm transition-all duration-150"
            >
              Get Involved
            </Link>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-slate-500"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.div>
      </section>

      {/* ── Mission + Pillars ──────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          <RevealOnScrollWrapper>
            <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-8 h-full">
              <h2 className="font-heading text-2xl font-bold text-white mb-4">Our Mission &amp; History</h2>
              <div className="space-y-4 text-slate-300 leading-relaxed text-sm">
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
            <div className="rounded-2xl bg-gradient-to-br from-indigo-900/40 to-violet-900/40 border border-indigo-700/30 p-8 h-full flex flex-col justify-between">
              <div>
                <h2 className="font-heading text-2xl font-bold text-white mb-3">Get Involved</h2>
                <p className="text-slate-300 text-sm leading-relaxed mb-6">
                  Come to our events and immerse yourself in Vietnamese culture! Connect with our
                  community and meet cabinet members who are passionate about making you feel at home.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/events"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors duration-150"
                >
                  Upcoming Events
                </Link>
                {!user && (
                  <Link
                    to="/signin"
                    className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-semibold transition-colors duration-150"
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
          <h2 className="font-heading text-2xl font-bold text-white text-center mb-8">Our Four Pillars</h2>
        </RevealOnScrollWrapper>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {pillars.map((p, i) => (
            <RevealOnScrollWrapper key={p.label} delay={i * 0.08}>
              <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-6 text-center hover:border-indigo-500/30 transition-colors duration-200">
                <span className="text-3xl mb-3 block">{p.icon}</span>
                <h3 className="font-heading font-semibold text-white mb-2">{p.label}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{p.description}</p>
              </div>
            </RevealOnScrollWrapper>
          ))}
        </div>
      </section>

      {/* ── Upcoming Events ────────────────────────────────────── */}
      <section className="pb-20 px-4 sm:px-6 max-w-7xl mx-auto">
        <RevealOnScrollWrapper>
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-heading text-2xl font-bold text-white">Upcoming Events</h2>
            <Link
              to="/events"
              className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors duration-150"
            >
              View all →
            </Link>
          </div>
        </RevealOnScrollWrapper>

        {eventsLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 rounded-full border-2 border-slate-700 border-t-indigo-500 animate-spin" />
          </div>
        ) : eventsError ? (
          <div className="rounded-xl bg-red-900/20 border border-red-800/40 p-6 text-red-400 text-sm text-center">
            Failed to load events — please try again later.
          </div>
        ) : upcomingEvents.length === 0 ? (
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-10 text-center">
            <p className="text-slate-400">No upcoming events at the moment. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingEvents.map((event, i) => (
              <RevealOnScrollWrapper key={event.id} delay={i * 0.08}>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-2xl bg-slate-900 border border-slate-800/80 overflow-hidden hover:border-indigo-500/30 transition-colors duration-200 shadow-card"
                >
                  {event.image_url && (
                    <div className="h-40 overflow-hidden">
                      <img src={event.image_url} alt={event.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-5">
                    <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-600/20 text-indigo-400 mb-3">
                      {EVENT_TYPE_LABELS[event.event_type]}
                    </span>
                    <h3 className="font-heading font-semibold text-white mb-1.5 line-clamp-1">{event.name}</h3>
                    <p className="text-slate-400 text-xs line-clamp-2 mb-3">{event.description}</p>
                    <p className="text-slate-500 text-xs">
                      {format(new Date(event.date), 'MMM d, yyyy')}
                    </p>
                  </div>
                </motion.div>
              </RevealOnScrollWrapper>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
