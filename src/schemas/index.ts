import { z } from 'zod';

export const SignInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const FeedbackSchema = z.object({
  type: z.enum(['bug', 'feature', 'improvement', 'event', 'other']),
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
  description: z.string().min(1, 'Description is required').max(1000, 'Description must be less than 1000 characters'),
  priority: z.enum(['low', 'medium', 'high']),
});

export type SignInFormData = z.infer<typeof SignInSchema>;
export type FeedbackFormData = z.infer<typeof FeedbackSchema>;
