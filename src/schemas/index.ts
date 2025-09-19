import { z } from 'zod';

// Event schemas
export const EventSchema = z.object({
  name: z.string().min(1, 'Event name is required').max(100, 'Event name must be less than 100 characters'),
  description: z.string().min(1, 'Description is required').max(500, 'Description must be less than 500 characters'),
  date: z.string().datetime('Invalid date format'),
  location: z.string().min(1, 'Location is required').max(100, 'Location must be less than 100 characters'),
  points: z.number().int().min(0, 'Points must be non-negative').max(1000, 'Points must be less than 1000'),
  event_type: z.enum(['gbm', 'mixer', 'winter_retreat', 'vcn', 'wildn_culture', 'external_event', 'other']),
  check_in_form_url: z.string().url('Invalid URL format'),
  image_url: z.string().url('Invalid image URL').optional().or(z.literal('')),
  check_in_code: z.string().min(1, 'Check-in code is required').max(20, 'Check-in code must be less than 20 characters').optional(),
  is_code_expired: z.boolean().default(false),
});

export const CreateEventSchema = EventSchema.omit({ id: true });
export const UpdateEventSchema = EventSchema.partial();

// User profile schemas
export const UserProfileSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(50, 'First name must be less than 50 characters'),
  last_name: z.string().min(1, 'Last name is required').max(50, 'Last name must be less than 50 characters'),
  avatar_url: z.string().url('Invalid avatar URL').optional().or(z.literal('')),
});

// Authentication schemas
export const SignInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const SignUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Password confirmation must be at least 6 characters'),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name must be less than 50 characters'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must be less than 50 characters'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Feedback schemas
export const FeedbackSchema = z.object({
  type: z.enum(['bug', 'feature', 'improvement', 'event', 'other']),
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
  description: z.string().min(1, 'Description is required').max(1000, 'Description must be less than 1000 characters'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});

// Event attendance schemas
export const CheckInCodeSchema = z.object({
  code: z.string().min(1, 'Check-in code is required').max(20, 'Check-in code must be less than 20 characters'),
});

// Chat schemas
export const ChatMessageSchema = z.object({
  message: z.string().min(1, 'Message is required').max(1000, 'Message must be less than 1000 characters'),
});

// Admin schemas
export const AdminEventUpdateSchema = z.object({
  id: z.string().uuid('Invalid event ID'),
  name: z.string().min(1, 'Event name is required').max(100, 'Event name must be less than 100 characters').optional(),
  description: z.string().min(1, 'Description is required').max(500, 'Description must be less than 500 characters').optional(),
  date: z.string().datetime('Invalid date format').optional(),
  location: z.string().min(1, 'Location is required').max(100, 'Location must be less than 100 characters').optional(),
  points: z.number().int().min(0, 'Points must be non-negative').max(1000, 'Points must be less than 1000').optional(),
  event_type: z.enum(['gbm', 'mixer', 'winter_retreat', 'vcn', 'wildn_culture', 'external_event', 'other']).optional(),
  check_in_form_url: z.string().url('Invalid URL format').optional(),
  image_url: z.string().url('Invalid image URL').optional().or(z.literal('')),
  check_in_code: z.string().min(1, 'Check-in code is required').max(20, 'Check-in code must be less than 20 characters').optional(),
  is_code_expired: z.boolean().optional(),
});

// Type exports for TypeScript
export type EventFormData = z.infer<typeof EventSchema>;
export type CreateEventFormData = z.infer<typeof CreateEventSchema>;
export type UpdateEventFormData = z.infer<typeof UpdateEventSchema>;
export type UserProfileFormData = z.infer<typeof UserProfileSchema>;
export type SignInFormData = z.infer<typeof SignInSchema>;
export type SignUpFormData = z.infer<typeof SignUpSchema>;
export type FeedbackFormData = z.infer<typeof FeedbackSchema>;
export type CheckInCodeFormData = z.infer<typeof CheckInCodeSchema>;
export type ChatMessageFormData = z.infer<typeof ChatMessageSchema>;
export type AdminEventUpdateFormData = z.infer<typeof AdminEventUpdateSchema>;
