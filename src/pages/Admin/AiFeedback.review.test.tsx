import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminAiFeedback from './AiFeedback';
import { aiFeedbackRepository } from '../../data/repos/aiFeedback';

jest.mock('../../data/repos/aiFeedback', () => ({
  aiFeedbackRepository: {
    listAdminFeedback: jest.fn(),
    updateAdminNotes: jest.fn(),
    markResolved: jest.fn(),
    markUnresolved: jest.fn(),
  },
}));

const list = aiFeedbackRepository.listAdminFeedback as jest.Mock;
const update = aiFeedbackRepository.updateAdminNotes as jest.Mock;

const example = {
  id: 'synthetic-feedback-1',
  rating: 'not_helpful' as const,
  category: 'events',
  page_path: '/events',
  feedback_text: 'The event information is outdated.',
  answer_excerpt: 'Check the calendar.',
  created_at: '2026-10-01T18:00:00Z',
  resolved_at: null,
  admin_notes: null,
};

function renderPage(path = '/admin/ai-feedback') {
  return render(<MemoryRouter initialEntries={[path]}><AdminAiFeedback /></MemoryRouter>);
}

beforeEach(() => {
  list.mockReset().mockResolvedValue([example]);
  update.mockReset().mockResolvedValue(undefined);
  (aiFeedbackRepository.markResolved as jest.Mock).mockReset().mockResolvedValue(undefined);
  (aiFeedbackRepository.markUnresolved as jest.Mock).mockReset().mockResolvedValue(undefined);
});

describe('Ask VSA feedback: private review notes (#237)', () => {
  it('saves a trimmed admin-only note and offers the existing knowledge editor', async () => {
    renderPage();
    const note = await screen.findByRole('textbox', { name: 'Internal review note' });
    expect(screen.getByRole('link', { name: /Review knowledge base/i })).toHaveAttribute('href', '/admin/ai-knowledge');
    expect(screen.getByText(/Do not include names, emails, hashed identifiers or raw chats/)).toBeInTheDocument();

    const save = screen.getByRole('button', { name: /Save review note/i });
    expect(save).toBeDisabled();
    const resolve = screen.getByRole('button', { name: 'Mark Resolved' });
    fireEvent.change(note, { target: { value: '  Confirm current event eligibility.  ' } });
    expect(resolve).toBeDisabled();
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() => expect(update).toHaveBeenCalledWith('synthetic-feedback-1', 'Confirm current event eligibility.'));
    await waitFor(() => expect(save).toBeDisabled());
    expect(resolve).toBeEnabled();
    expect(aiFeedbackRepository.markResolved).not.toHaveBeenCalled();
  });

  it('keeps an unsaved note when a filter reloads the same feedback', async () => {
    renderPage();
    const note = await screen.findByRole('textbox', { name: 'Internal review note' });
    fireEvent.change(note, { target: { value: 'Keep this draft while filtering' } });
    fireEvent.change(screen.getByLabelText('Rating'), { target: { value: 'not_helpful' } });
    await waitFor(() => expect(list).toHaveBeenCalledWith({ status: 'unresolved', rating: 'not_helpful' }));
    expect(await screen.findByRole('textbox', { name: 'Internal review note' })).toHaveValue('Keep this draft while filtering');
    expect(screen.getByRole('button', { name: /Save review note/i })).toBeEnabled();
  });

  it('hydrates remote notes after a draft is reverted to its original value', async () => {
    list.mockReset()
      .mockResolvedValueOnce([example])
      .mockResolvedValue([{ ...example, admin_notes: 'Updated by another admin' }]);
    renderPage();
    const note = await screen.findByRole('textbox', { name: 'Internal review note' });
    fireEvent.change(note, { target: { value: 'Temporary draft' } });
    fireEvent.change(note, { target: { value: '' } });
    expect(screen.getByRole('button', { name: /Save review note/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Rating'), { target: { value: 'not_helpful' } });
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Internal review note' })).toHaveValue('Updated by another admin'));
  });

  it('removes a just-resolved item from the unresolved inbox without a stale action', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: 'Mark Resolved' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Mark Resolved' }));
    await waitFor(() => expect(aiFeedbackRepository.markResolved).toHaveBeenCalledWith('synthetic-feedback-1'));
    expect(await screen.findByText('No feedback found for these filters.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark Resolved' })).not.toBeInTheDocument();
  });

  it('reopens resolved feedback for continued review while keeping the item in All', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: 'Mark Resolved' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'all' } });
    await waitFor(() => expect(list).toHaveBeenCalledWith({ status: 'all', rating: 'all' }));
    // Changing the URL filter triggers a request and temporarily hides the
    // list. Wait for the new filtered view before exercising its action.
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Resolved' }));
    expect(await screen.findByRole('button', { name: 'Reopen for review' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reopen for review' }));
    await waitFor(() => expect(aiFeedbackRepository.markUnresolved).toHaveBeenCalledWith('synthetic-feedback-1'));
    expect(await screen.findByRole('button', { name: 'Mark Resolved' })).toBeInTheDocument();
  });

  it('removes a reopened item from the resolved-only inbox', async () => {
    list.mockResolvedValue([{ ...example, resolved_at: '2026-10-02T18:00:00Z' }]);
    renderPage('/admin/ai-feedback?filter=resolved');
    fireEvent.click(await screen.findByRole('button', { name: 'Reopen for review' }));
    await waitFor(() => expect(aiFeedbackRepository.markUnresolved).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('No feedback found for these filters.')).toBeInTheDocument();
  });

  it('keeps status unchanged with an accessible retry if reopening fails', async () => {
    list.mockResolvedValue([{ ...example, resolved_at: '2026-10-02T18:00:00Z' }]);
    (aiFeedbackRepository.markUnresolved as jest.Mock).mockRejectedValueOnce(new Error('permission denied'));
    renderPage('/admin/ai-feedback?filter=resolved');
    fireEvent.click(await screen.findByRole('button', { name: 'Reopen for review' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not update feedback status');
    expect(screen.getByRole('button', { name: 'Reopen for review' })).toBeEnabled();
    expect(screen.queryByText('No feedback found for these filters.')).not.toBeInTheDocument();
  });

  it('does not allow status changes while an unsaved review note is present', async () => {
    list.mockResolvedValue([{ ...example, resolved_at: '2026-10-02T18:00:00Z' }]);
    renderPage('/admin/ai-feedback?filter=resolved');
    const note = await screen.findByRole('textbox', { name: 'Internal review note' });
    fireEvent.change(note, { target: { value: 'Investigating which published answer needs correction' } });
    expect(screen.getByRole('button', { name: 'Reopen for review' })).toBeDisabled();
    fireEvent.change(note, { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Reopen for review' })).toBeEnabled();
  });

  it('keeps the note editable and exposes a retry message when saving fails', async () => {
    update.mockRejectedValueOnce(new Error('simulated server error'));
    renderPage();
    const note = await screen.findByRole('textbox', { name: 'Internal review note' });
    fireEvent.change(note, { target: { value: 'Verify published event listing.' } });
    fireEvent.click(screen.getByRole('button', { name: /Save review note/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Note could not be saved');
    expect(note).toHaveValue('Verify published event listing.');
    expect(screen.getByRole('button', { name: /Save review note/i })).toBeEnabled();
  });
});
