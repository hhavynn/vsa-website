import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useEvents } from "../hooks/useEvents";
import { PageTitle } from "../components/PageTitle";
import { motion } from "framer-motion";
import { RevealOnScrollWrapper } from "../components/RevealOnScrollWrapper";
import { Event } from "../types";
import { EVENT_TYPE_LABELS } from "../constants/eventTypes";

export function Home() {
  const { user } = useAuth();
  const { events, loading: eventsLoading, error: eventsError } = useEvents();
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    const date = new Date();
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    setCurrentDate(date.toLocaleDateString(undefined, options));
  }, []);

  return (
    <>
      <PageTitle title="Home" />
      <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-white pb-12 overflow-x-hidden transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="space-y-8">
            {/* Welcome Section */}
            <div className="relative rounded-2xl p-8 overflow-hidden bg-gradient-to-r from-indigo-600 to-purple-600">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-70"></div>
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-center md:justify-between text-center md:text-left">
                <div>
                  <p className="text-white/80 text-lg mb-2 text-center md:text-left">
                    {currentDate}
                  </p>
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-4">
                    Welcome to VSA at UCSD!
                  </h1>
                </div>
                <img
                  src="/images/vsa-logo.png"
                  alt="VSALogo"
                  className="h-24 md:h-40 w-auto mt-4 md:mt-0"
                  loading="lazy"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Mission Statement Box (Left) */}
              <RevealOnScrollWrapper>
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 text-gray-900 dark:text-white">
                  <h2 className="text-2xl font-bold mb-4">Mission Statement</h2>
                  <p className="text-gray-700 dark:text-gray-300">
                    The Vietnamese Student Association of UCSD strives to
                    promote and preserve the Vietnamese culture. We are
                    dedicated to providing resources and a safe space for
                    students to unite as a Vietnamese-American community. This
                    organization is for nonprofit.
                  </p>
                </div>
              </RevealOnScrollWrapper>

              {/* Get Involved Section (Middle) */}
              <RevealOnScrollWrapper>
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6">
                  <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                    Get Involved
                  </h2>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl shadow p-4">
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                      Come to our events and immerse yourself in Vietnamese
                      culture! Connect with our community and meet our cabinet
                      members.
                    </p>
                    {!user && (
                      <motion.a
                        href="/events"
                        className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-500 transition-colors duration-200"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        View Events
                      </motion.a>
                    )}
                  </div>
                </div>
              </RevealOnScrollWrapper>

              {/* Our 4 Pillars Box (Right) */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 text-gray-900 dark:text-white">
                <h2 className="text-2xl font-bold mb-4">Our 4 Pillars</h2>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
                  <li>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      Social:
                    </span>{" "}
                    meeting new people and building bonds with one another such
                    as the ACE Program and House System
                  </li>
                  <li>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      Cultural:
                    </span>{" "}
                    stay in touch with cultural roots through our events such as
                    Vietnamese Culture Night and Black April
                  </li>
                  <li>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      Community:
                    </span>{" "}
                    continue to strive to create a supportive and cooperative
                    community for those of Vietnamese and non-Vietnamese descent
                  </li>
                  <li>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      Academic:
                    </span>{" "}
                    main priority of obtaining good grades and graduating within
                    a reasonable amount of time
                  </li>
                </ul>
              </div>
            </div>

            {/* Upcoming Events Section */}
            <RevealOnScrollWrapper>
              <div className="mt-8 bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 text-gray-900 dark:text-white">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">Upcoming Events</h2>
                  <motion.a
                    href="/events"
                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors duration-200"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    See all events &gt;
                  </motion.a>
                </div>
                {eventsLoading ? (
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
                  </div>
                ) : eventsError ? (
                  <div className="text-center text-red-400 bg-red-900/20 p-4 rounded-lg">
                    Error loading events:{" "}
                    {eventsError instanceof Error
                      ? eventsError.message
                      : "Unknown error"}
                  </div>
                ) : (
                  (() => {
                    // Only show upcoming events (today or in the future, with 1-day grace period)
                    const now = new Date();
                    const oneDayAgo = new Date(
                      now.getTime() - 24 * 60 * 60 * 1000
                    );
                    const upcomingEvents = events
                      .filter((event) => new Date(event.date) >= oneDayAgo)
                      .sort(
                        (a, b) =>
                          new Date(a.date).getTime() -
                          new Date(b.date).getTime()
                      );

                    if (upcomingEvents.length === 0) {
                      return (
                        <div className="bg-gray-800 shadow-xl rounded-lg p-6">
                          <p className="text-gray-300">
                            No upcoming events at the moment.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {upcomingEvents.map((event) => (
                          <div
                            key={event.id}
                            className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 text-gray-900 dark:text-white flex flex-col"
                          >
                            <img
                              src={
                                event.image_url || "/images/events/default.jpg"
                              }
                              alt={event.name}
                              className="w-full h-40 object-cover rounded-md mb-4"
                            />
                            <h3 className="text-lg font-bold mb-2">
                              {event.name}
                            </h3>
                            <p className="text-gray-700 dark:text-gray-300 mb-2">
                              {event.description}
                            </p>
                            <span className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                              {new Date(event.date).toLocaleDateString()}
                            </span>
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200 self-start mb-2">
                              {EVENT_TYPE_LABELS[event.event_type]}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                )}
              </div>
            </RevealOnScrollWrapper>
          </div>
        </div>
      </div>
    </>
  );
}
