import { ApplicationLinkFormSchema, ApplicationLinkFormValues, applicationLinkPayload, isDriveLink } from './applicationLink';

const valid: ApplicationLinkFormValues = {
  application_key: 'ace_application',
  title: '  ACE Application ',
  description: '   ',
  button_label: 'Apply Now',
  target_url: ' https://forms.gle/abc ',
  open_date: '2026-10-01',
  open_time: '',
  due_date: '2026-10-15',
  due_time: '',
  is_enabled: true,
  before_open_message: '',
  after_close_message: ' closed ',
  sort_order: 'abc',
};

const messages = (input: ApplicationLinkFormValues) => {
  const result = ApplicationLinkFormSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
};

describe('ApplicationLinkFormSchema', () => {
  it('accepts a complete form and keeps the page rules (https only, due after open)', () => {
    expect(messages(valid)).toEqual([]);
    expect(messages({ ...valid, target_url: 'http://forms.gle/abc' })).toEqual(['target_url: Target URL must start with https://']);
    expect(messages({ ...valid, target_url: 'https://' })).toEqual(['target_url: Enter a complete URL, like https://forms.gle/abc']);
    expect(messages({ ...valid, target_url: '   ' })).toEqual(['target_url: Target URL is required']);
    expect(messages({ ...valid, due_date: '2026-10-01', due_time: '00:00' })).toEqual(['due_date: Due date/time must be after the open date/time']);
    expect(messages({ ...valid, open_date: '' })).toEqual(['open_date: Open date is required']);
    expect(messages({ ...valid, title: '  ', button_label: '' })).toEqual(['title: Title is required', 'button_label: Button label is required']);
  });

  it('rejects dates that do not exist', () => {
    expect(messages({ ...valid, open_date: '2026-02-30' })).toEqual(['open_date: Invalid open date or time']);
  });
});

describe('applicationLinkPayload', () => {
  it('trims, nulls blanks, and falls back to 00:00 / 23:59 / sort 0 exactly as before', () => {
    const payload = applicationLinkPayload(valid);
    expect(payload).toEqual({
      application_key: 'ace_application',
      title: 'ACE Application',
      description: null,
      button_label: 'Apply Now',
      target_url: 'https://forms.gle/abc',
      open_at: expect.stringMatching(/^2026-10-01T07:00:00/),
      due_at: expect.stringMatching(/^2026-10-16T06:59:00/),
      is_enabled: true,
      before_open_message: null,
      after_close_message: 'closed',
      sort_order: 0,
    });
  });
});

describe('isDriveLink', () => {
  it('flags Drive hosts only', () => {
    expect(isDriveLink('https://drive.google.com/file/d/1')).toBe(true);
    expect(isDriveLink('https://forms.gle/abc')).toBe(false);
  });
});
