import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { planBulk } from '../../../../lib/adminBulk';
import { BulkRunDialog } from './BulkRunDialog';

interface Row { id: string; name: string; published: boolean }
const rows: Row[] = Array.from({ length: 6 }, (_, i) => ({ id: String(i), name: `Event ${i}`, published: i < 5 }));

function setup(run: (row: Row) => Promise<unknown>, destructive = false, items = rows) {
  const plan = planBulk(items, (row) => (row.published ? null : 'Already a draft'), { verb: 'Unpublish', noun: 'event', destructive });
  const onFinished = jest.fn();
  const onClose = jest.fn();
  render(
    <BulkRunDialog
      open
      title="Unpublish events"
      plan={plan}
      noun="event"
      verb="unpublish"
      past="Unpublished"
      itemLabel={(row) => row.name}
      changeLabel={() => 'Published → Draft'}
      scopeNote="All 6 events matching “Spring”."
      run={run}
      onFinished={onFinished}
      onClose={onClose}
    />,
  );
  return { onFinished, onClose };
}

describe('BulkRunDialog', () => {
  it('previews exactly what changes and what is skipped, before writing anything', () => {
    const run = jest.fn().mockResolvedValue(undefined);
    setup(run);
    expect(screen.getByText('All 6 events matching “Spring”.')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Items that will change' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);
    expect(within(list).getAllByText('Published → Draft')).toHaveLength(5);
    expect(screen.getByText(/Event 5 — Already a draft/)).toBeInTheDocument();
    expect(run).not.toHaveBeenCalled();
  });

  it('runs every eligible item and reports success with a count', async () => {
    const run = jest.fn().mockResolvedValue(undefined);
    const { onFinished } = setup(run);
    await userEvent.click(screen.getByRole('button', { name: 'Unpublish 5' }));
    expect(await screen.findByText('Unpublished 5 events.')).toBeInTheDocument();
    expect(run).toHaveBeenCalledTimes(5);
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('reports partial failure per item and lets the admin retry only the failures', async () => {
    let failEvent2 = true;
    const run = jest.fn(async (row: Row) => {
      if (row.id === '2' && failEvent2) throw new Error('permission denied');
    });
    setup(run);
    await userEvent.click(screen.getByRole('button', { name: 'Unpublish 5' }));
    expect(await screen.findByText('Unpublished 4 of 5 events. 1 failed and were left unchanged.')).toBeInTheDocument();
    expect(screen.getByText('Event 2 — permission denied')).toBeInTheDocument();
    failEvent2 = false;
    await userEvent.click(screen.getByRole('button', { name: 'Retry 1 failed' }));
    await waitFor(() => expect(screen.getByText('Unpublished 5 events.')).toBeInTheDocument());
    expect(run).toHaveBeenCalledTimes(6);
  });

  it('requires typing the count for a destructive plan of several items', async () => {
    const run = jest.fn().mockResolvedValue(undefined);
    setup(run, true);
    const go = screen.getByRole('button', { name: 'Unpublish 5' });
    expect(go).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/type 5 events to confirm/i), '5 events');
    expect(go).toBeEnabled();
  });
});
