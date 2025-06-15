import React from 'react';
import { FeedbackForm } from '../components/Feedback/FeedbackForm';
import { PageTitle } from '../components/PageTitle';

export const FeedbackPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <PageTitle title="Feedback" />
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Help Us Improve
          </h2>
          <p className="text-gray-600">
            Your feedback helps us make the website better for everyone. Please let us know what you think!
          </p>
        </div>
        <FeedbackForm />
      </div>
    </div>
  );
}; 