import { z } from 'zod';
import type { ApplicationLinkFormData } from '../data/repos/applicationLinks';
import { APPLICATION_KEYS, combineLocalDateTime } from '../lib/applicationLinks';
import type { ApplicationKey } from '../types';

// The admin "application link" form. Client-side validation only: it mirrors
// what the page always enforced (and what the database requires) so mistakes
// show beside the field. application_links_window_check (due_at > open_at) and
// application_links_key_check stay authoritative on the server.

const keyTuple = APPLICATION_KEYS as [ApplicationKey, ...ApplicationKey[]];

export const ApplicationLinkFormSchema = z
  .object({
    application_key: z.enum(keyTuple, { errorMap: () => ({ message: 'Choose an application type' }) }),
    title: z.string().trim().min(1, 'Title is required'),
    description: z.string(),
    button_label: z.string().trim().min(1, 'Button label is required'),
    target_url: z
      .string()
      .trim()
      .min(1, 'Target URL is required')
      .refine((value) => value === '' || /^https:\/\//i.test(value), 'Target URL must start with https://')
      .refine((value) => !/^https:\/\//i.test(value) || canParseUrl(value), 'Enter a complete URL, like https://forms.gle/abc'),
    open_date: z.string().min(1, 'Open date is required'),
    open_time: z.string(),
    due_date: z.string().min(1, 'Due date is required'),
    due_time: z.string(),
    is_enabled: z.boolean(),
    before_open_message: z.string(),
    after_close_message: z.string(),
    sort_order: z.string(),
  })
  .superRefine((value, ctx) => {
    // Only check the schedule once both dates are present; missing dates already have their own message.
    if (!value.open_date || !value.due_date) return;
    const open = combineLocalDateTime(value.open_date, value.open_time, '00:00');
    const due = combineLocalDateTime(value.due_date, value.due_time, '23:59');
    if (!open) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['open_date'], message: 'Invalid open date or time' });
    if (!due) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['due_date'], message: 'Invalid due date or time' });
    if (open && due && new Date(due).getTime() <= new Date(open).getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['due_date'], message: 'Due date/time must be after the open date/time' });
    }
  });

export type ApplicationLinkFormValues = z.input<typeof ApplicationLinkFormSchema>;

function canParseUrl(value: string): boolean {
  try {
    return Boolean(new URL(value).host);
  } catch {
    return false;
  }
}

/** True for Drive links, which need an explicit "this is public" acknowledgement before saving. */
export function isDriveLink(url: string): boolean {
  return /drive\.google\.com/i.test(url);
}

/**
 * The exact payload the repository receives. Throws if the schedule is not
 * valid, which the schema has already ruled out by the time this runs.
 */
export function applicationLinkPayload(form: ApplicationLinkFormValues): ApplicationLinkFormData {
  const openIso = combineLocalDateTime(form.open_date, form.open_time, '00:00');
  const dueIso = combineLocalDateTime(form.due_date, form.due_time, '23:59');
  if (!openIso || !dueIso) throw new Error('Invalid open or due date');
  return {
    application_key: form.application_key,
    title: form.title.trim(),
    description: form.description.trim() || null,
    button_label: form.button_label.trim(),
    target_url: form.target_url.trim(),
    open_at: openIso,
    due_at: dueIso,
    is_enabled: form.is_enabled,
    before_open_message: form.before_open_message.trim() || null,
    after_close_message: form.after_close_message.trim() || null,
    sort_order: Number(form.sort_order) || 0,
  };
}
