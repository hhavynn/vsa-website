import React from 'react';
import { useChat } from '../../context/ChatContext';
import { SetupInstructions } from './SetupInstructions';
import { resetRateLimit } from '../../lib/chatApi';

// This is a test component to verify the chat assistant is working
// You can temporarily add this to any page to test the chat functionality
export const ChatTest: React.FC = () => {
  const { messages, sendMessage, clearChat } = useChat();

  const testMessages = [
    "What is VSA's mission?",
    "How do I earn points?",
    "What events are coming up?",
    "Tell me about the 4 pillars",
  ];

  return (
    <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Chat Assistant Test</h3>
      <SetupInstructions />
      <div className="space-y-2">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Click the chat button in the bottom-right corner to test the assistant.
        </p>
        <div className="flex flex-wrap gap-2">
          {testMessages.map((message, index) => (
            <button
              key={index}
              onClick={() => sendMessage(message)}
              className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
            >
              {message}
            </button>
          ))}
        </div>
        <button
          onClick={clearChat}
          className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
        >
          Clear Chat
        </button>
        <button
          onClick={() => {
            resetRateLimit();
            alert('Rate limit reset! You can now try the AI responses again.');
          }}
          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
        >
          Reset Rate Limit
        </button>
        <div className="mt-4">
          <p className="text-sm font-medium">Messages: {messages.length}</p>
        </div>
      </div>
    </div>
  );
};
