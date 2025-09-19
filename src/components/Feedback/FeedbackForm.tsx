import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'react-hot-toast';
import { FeedbackSchema, type FeedbackFormData } from '../../schemas';

interface FeedbackFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const FeedbackForm: React.FC<FeedbackFormProps> = ({ onSuccess, onCancel }) => {
  const { user } = useAuth();
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setError: setFormError,
  } = useForm<FeedbackFormData>({
    resolver: zodResolver(FeedbackSchema),
    defaultValues: {
      type: 'feature',
      priority: 'medium',
    },
  });

  const onSubmit = async (data: FeedbackFormData) => {
    if (!user) {
      toast.error('Please sign in to submit feedback');
      return;
    }

    try {
      const { error } = await supabase
        .from('feedback')
        .insert([
          {
            user_id: user.id,
            type: data.type,
            title: data.title.trim(),
            description: data.description.trim(),
            priority: data.priority,
          },
        ]);

      if (error) throw error;

      toast.success('Thank you for your feedback!');
      reset();
      onSuccess?.();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit feedback. Please try again.';
      setFormError('root', { 
        type: 'manual', 
        message: errorMessage 
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 w-full">
      <div className="flex flex-col md:flex-row md:space-x-2">
        <div className="flex-1 mb-2 md:mb-0">
          <label htmlFor="type" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 font-sans">
            Type
          </label>
          <select
            id="type"
            {...register('type')}
            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="bug">Bug</option>
            <option value="feature">Feature</option>
            <option value="improvement">Improvement</option>
            <option value="event">Event</option>
            <option value="other">Other</option>
          </select>
          {errors.type && (
            <p className="mt-1 text-xs text-red-400">{errors.type.message}</p>
          )}
        </div>
        <div className="flex-1">
          <label htmlFor="title" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 font-sans">
            Title
          </label>
          <input
            type="text"
            id="title"
            {...register('title')}
            placeholder="Brief summary"
            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          {errors.title && (
            <p className="mt-1 text-xs text-red-400">{errors.title.message}</p>
          )}
        </div>
      </div>
      <div>
        <label htmlFor="description" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 font-sans">
          Description
        </label>
        <textarea
          id="description"
          {...register('description')}
          placeholder="How can we help?"
          rows={2}
          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
        />
        {errors.description && (
          <p className="mt-1 text-xs text-red-400">{errors.description.message}</p>
        )}
      </div>
      
      {errors.root && (
        <div className="p-2 rounded-md bg-red-900 text-red-300 text-xs">
          {errors.root.message}
        </div>
      )}
      
      <div className="flex justify-end space-x-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-1 text-xs font-semibold font-heading text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Sending...' : 'Send'}
        </button>
      </div>
    </form>
  );
}; 