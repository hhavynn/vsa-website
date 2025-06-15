import React from 'react';
import { FaInstagram, FaDiscord, FaFacebook, FaEnvelope } from 'react-icons/fa';
import type { IconBaseProps } from 'react-icons';

const Footer: React.FC = () => {
  const InstagramIcon = FaInstagram as unknown as React.ComponentType<IconBaseProps>;
  const DiscordIcon = FaDiscord as unknown as React.ComponentType<IconBaseProps>;
  const FacebookIcon = FaFacebook as unknown as React.ComponentType<IconBaseProps>;
  const EnvelopeIcon = FaEnvelope as unknown as React.ComponentType<IconBaseProps>;

  return (
    <footer className="bg-gray-100 dark:bg-gray-800 py-8 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center">
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Connect With Us!</h2>
          <div className="flex space-x-6">
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
          <p className="mt-4 text-gray-600 dark:text-gray-400 text-sm">
            © {new Date().getFullYear()} VSA. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 