import React from 'react';
import { FaInstagram, FaDiscord, FaFacebook, FaEnvelope } from 'react-icons/fa';
import type { IconBaseProps } from 'react-icons';
import { FeedbackForm } from './Feedback/FeedbackForm';

const Footer: React.FC = () => {
  const InstagramIcon = FaInstagram as unknown as React.ComponentType<IconBaseProps>;
  const DiscordIcon = FaDiscord as unknown as React.ComponentType<IconBaseProps>;
  const FacebookIcon = FaFacebook as unknown as React.ComponentType<IconBaseProps>;
  const EnvelopeIcon = FaEnvelope as unknown as React.ComponentType<IconBaseProps>;

  return (
    <footer className="bg-gray-100 dark:bg-gray-800 py-8 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center">
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white font-heading">Connect With Us!</h2>
          <div className="flex space-x-6 mb-6">
            <a
              href="https://instagram.com/ucsdvsa"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-pink-600 dark:text-gray-300 dark:hover:text-pink-400 transition-colors"
              aria-label="Instagram"
            >
              <InstagramIcon size={32} className="w-8 h-8" />
            </a>
            <a
              href="https://discord.gg/cSb6Q4gnW8"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400 transition-colors"
              aria-label="Discord"
            >
              <DiscordIcon size={32} className="w-8 h-8" />
            </a>
            <a
              href="https://facebook.com/ucsdvsa"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors"
              aria-label="Facebook"
            >
              <FacebookIcon size={32} className="w-8 h-8" />
            </a>
            <a
              href="mailto:ucsdvsa@ucsd.edu"
              className="text-gray-600 hover:text-red-600 dark:text-gray-300 dark:hover:text-red-400 transition-colors"
              aria-label="Email"
            >
              <EnvelopeIcon size={32} className="w-8 h-8" />
            </a>
          </div>
          <div className="w-full max-w-lg mb-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md p-4 md:p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2 font-heading text-center">Send Feedback</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 text-center">We value your thoughts! Let us know how we can improve or if you encountered any issues.</p>
              <FeedbackForm />
            </div>
          </div>
          <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm">
            © {new Date().getFullYear()} VSA. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 