import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { toast } from 'react-hot-toast';
import { FeedbackSchema, type FeedbackFormData } from '../../../schemas';

interface FeedbackFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  defaultType?: FeedbackFormData['type'];
  defaultTitle?: string;
}

const inputCls = 'w-full px-2 py-1 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 placeholder:text-zinc-400 dark:placeholder:text-zinc-600';
const labelCls = 'block text-xs font-medium text-zinc-500 uppercase tracking-widest mb-1';

export const FeedbackForm: React.FC<FeedbackFormProps> = ({ onSuccess, onCancel, defaultType = 'feature', defaultTitle = '' }) => {
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
      type: defaultType,
      title: defaultTitle,
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
          <label htmlFor="type" className={labelCls}>Type</label>
          <select
            id="type"
            {...register('type')}
            className={inputCls}
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
          <label htmlFor="title" className={labelCls}>Title</label>
          <input
            type="text"
            id="title"
            {...register('title')}
            placeholder="Brief summary"
            className={inputCls}
          />
          {errors.title && (
            <p className="mt-1 text-xs text-red-400">{errors.title.message}</p>
          )}
        </div>
      </div>
      <div>
        <label htmlFor="description" className={labelCls}>Description</label>
        <textarea
          id="description"
          {...register('description')}
          placeholder="How can we help?"
          rows={2}
          className={`${inputCls} resize-none`}
        />
        {errors.description && (
          <p className="mt-1 text-xs text-red-400">{errors.description.message}</p>
        )}
      </div>

      {errors.root && (
        <div className="p-2 rounded border border-red-900/40 bg-red-950/20 text-red-400 text-xs">
          {errors.root.message}
        </div>
      )}

      <div className="flex justify-end space-x-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors duration-150"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-1 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Sending...' : 'Send'}
        </button>
      </div>
    </form>
  );
};
