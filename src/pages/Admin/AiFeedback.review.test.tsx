import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminAiFeedback from './AiFeedback';
import { aiFeedbackRepository } from '../../data/repos/aiFeedback';

jest.mock('../../data/repos/aiFeedback', () => ({
  aiFeedbackRepository: {
    listAdminFeedback: jest.fn(),
    updateAdminNotes: jest.fn(),
    markResolved: jest.fn(),
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

function renderPage() {
  return render(<MemoryRouter initialEntries={['/admin/ai-feedback']}><AdminAiFeedback /></MemoryRouter>);
}

beforeEach(() => {
  list.mockReset().mockResolvedValue([example]);
  update.mockReset().mockResolvedValue(undefined);
  (aiFeedbackRepository.markResolved as jest.Mock).mockReset().mockResolvedValue(undefined);
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
