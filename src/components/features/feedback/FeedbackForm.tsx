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
      name: '',
      email: '',
    },
  });

  const onSubmit = async (data: FeedbackFormData) => {
    try {
      const { error } = await supabase
        .from('feedback')
        .insert([
          {
            user_id: user?.id || null,
            type: data.type,
            title: data.title.trim(),
            description: data.description.trim(),
            priority: data.priority,
            name: data.name?.trim() || null,
            email: data.email?.trim() || null,
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 w-full" aria-describedby="feedback-privacy-note">
      <p id="feedback-privacy-note" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-3 text-xs leading-5 text-[var(--color-text2)]">
        Authorized VSA website administrators review submissions. Name and email are optional. Do not include passwords,
        payment information, check-in codes, or other sensitive details.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="name" className={labelCls}>Name (Optional)</label>
          <input
            type="text"
            id="name"
            {...register('name')}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'feedback-name-error' : undefined}
            placeholder="Your name"
            className={inputCls}
          />
          {errors.name && (
            <p id="feedback-name-error" role="alert" className="mt-1 text-xs text-red-400">{errors.name.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="email" className={labelCls}>Email (Optional)</label>
          <input
            type="email"
            id="email"
            {...register('email')}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'feedback-email-error' : undefined}
            placeholder="Your email"
            className={inputCls}
          />
          {errors.email && (
            <p id="feedback-email-error" role="alert" className="mt-1 text-xs text-red-400">{errors.email.message}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="type" className={labelCls}>Category</label>
          <select
            id="type"
            {...register('type')}
            aria-invalid={Boolean(errors.type)}
            aria-describedby={errors.type ? 'feedback-type-error' : undefined}
            className={inputCls}
          >
            <option value="bug">Bug Report</option>
            <option value="feature">Feature Request</option>
            <option value="improvement">Improvement</option>
            <option value="event">Event Feedback</option>
            <option value="other">Other</option>
          </select>
          {errors.type && (
            <p id="feedback-type-error" role="alert" className="mt-1 text-xs text-red-400">{errors.type.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="title" className={labelCls}>Subject</label>
          <input
            type="text"
            id="title"
            {...register('title')}
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? 'feedback-title-error' : undefined}
            placeholder="What's on your mind?"
            className={inputCls}
          />
          {errors.title && (
            <p id="feedback-title-error" role="alert" className="mt-1 text-xs text-red-400">{errors.title.message}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="description" className={labelCls}>Message</label>
        <textarea
          id="description"
          {...register('description')}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? 'feedback-description-error' : undefined}
          placeholder="Detailed description..."
          rows={4}
          className={`${inputCls} resize-none`}
        />
        {errors.description && (
          <p id="feedback-description-error" role="alert" className="mt-1 text-xs text-red-400">{errors.description.message}</p>
        )}
      </div>

      {errors.root && (
        <div role="alert" className="p-3 rounded border border-red-900/40 bg-red-950/20 text-red-400 text-xs">
          {errors.root.message}
        </div>
      )}

      <div className="flex justify-end pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mr-3 px-4 py-2 text-sm font-medium text-[var(--color-text2)] hover:text-[var(--color-text)] transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="rounded-lg bg-[var(--brand)] px-6 py-2.5 font-sans text-[13px] font-semibold text-white transition-opacity duration-150 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Sending...' : 'Submit Feedback'}
        </button>
      </div>
    </form>
  );
};
