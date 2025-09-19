import React from 'react';

export const SetupInstructions: React.FC = () => {
  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
      <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
        🔧 Chat Assistant Setup Required
      </h3>
      <div className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
        <p>To enable full AI functionality:</p>
        <ol className="list-decimal list-inside ml-2 space-y-1">
          <li>Get an OpenAI API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">platform.openai.com</a></li>
          <li>Create a <code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">.env</code> file in the project root</li>
          <li>Add: <code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">REACT_APP_OPENAI_API_KEY=your_key_here</code></li>
          <li>Restart the development server</li>
        </ol>
        <p className="mt-2 text-yellow-600 dark:text-yellow-400">
          <strong>Note:</strong> The chat currently works with basic responses for common VSA questions.
        </p>
      </div>
    </div>
  );
};
