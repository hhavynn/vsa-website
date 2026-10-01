import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OperationsDashboard } from './OperationsDashboard';
import { OperationsInputs } from '../../../lib/adminOperations';

const inputs: OperationsInputs = {
  yearStart: 2026,
  members: 614,
  ace: { cycleStatus: 'draft', littles: 47, assigned: 42, nodesTotal: 73, nodesLinked: 68 },
  houses: { batchStatus: 'draft', assigned: 126, unresolved: 3, balance: [31, 32, 32, 31] },
  cabinet: { yearLabel: '2026–27', positions: 19, filled: 19, linked: 17, rollover: null },
  interns: { cycleStatus: 'draft', accepted: 12, linked: 10 },
  events: { next: { title: 'General Body Meeting', date: '2026-10-10T01:00:00Z' }, upcoming: 4, upcomingMissingLocation: 1, upcomingMissingInfo: 1 },
};

function renderDashboard(load: () => Promise<OperationsInputs>) {
  return render(
    <MemoryRouter>
      <OperationsDashboard loadInputs={load} />
    </MemoryRouter>,
  );
}

describe('OperationsDashboard', () => {
  it('shows the year heading and each program card with its numbers', async () => {
    renderDashboard(() => Promise.resolve(inputs));

    expect(await screen.findByRole('heading', { name: '2026–27 VSA Operations' })).toBeInTheDocument();

    const members = screen.getByRole('region', { name: 'Members' });
    expect(within(members).getByText(/614/)).toBeInTheDocument();

    const ace = screen.getByRole('region', { name: 'ACE' });
    expect(within(ace).getByText('Draft')).toBeInTheDocument();
    expect(within(ace).getByText('42 / 47')).toBeInTheDocument();
    expect(within(ace).getByText('68 / 73')).toBeInTheDocument();
    expect(within(ace).getByRole('link', { name: /10 need attention/ })).toHaveAttribute('href', '/admin/ace?view=assignments');

    const houses = screen.getByRole('region', { name: 'Houses' });
    expect(within(houses).getByText('126')).toBeInTheDocument();
    expect(within(houses).getByText('31 / 32 / 32 / 31')).toBeInTheDocument();

    const cabinet = screen.getByRole('region', { name: 'Cabinet' });
    expect(within(cabinet).getByText('19 / 19')).toBeInTheDocument();
    expect(within(cabinet).getByText('17')).toBeInTheDocument();

    const interns = screen.getByRole('region', { name: 'Interns' });
    expect(within(interns).getByText('12')).toBeInTheDocument();
    expect(within(interns).getByText('10')).toBeInTheDocument();

    const events = screen.getByRole('region', { name: 'Events' });
    expect(within(events).getByText('General Body Meeting')).toBeInTheDocument();
  });

  it('links each card to the tool that owns it', async () => {
    renderDashboard(() => Promise.resolve(inputs));
    await screen.findByRole('heading', { name: '2026–27 VSA Operations' });

    expect(within(screen.getByRole('region', { name: 'Members' })).getByRole('link', { name: /Admin Members/ })).toHaveAttribute('href', '/admin/members');
    expect(within(screen.getByRole('region', { name: 'Houses' })).getByRole('link', { name: /House assignments/ })).toHaveAttribute('href', '/admin/houses');
    expect(within(screen.getByRole('region', { name: 'Cabinet' })).getByRole('link', { name: /Current cabinet/ })).toHaveAttribute('href', '/admin/cabinet');
    expect(within(screen.getByRole('region', { name: 'Interns' })).getByRole('link', { name: /Admin Interns/ })).toHaveAttribute('href', '/admin/interns');
    expect(screen.getByRole('link', { name: /Start 2027–28/ })).toHaveAttribute('href', '/admin/year-setup');
  });

  it('renders the cross-program preflight with links to fix each issue', async () => {
    renderDashboard(() => Promise.resolve(inputs));
    const preflight = await screen.findByRole('region', { name: 'Operations preflight' });

    expect(within(preflight).getByText(/2026–27 Operations Preflight/)).toBeInTheDocument();
    expect(within(preflight).getByRole('link', { name: /5 unassigned/ })).toHaveAttribute('href', '/admin/ace?view=assignments');
    expect(within(preflight).getByRole('link', { name: /2 unlinked members/ })).toHaveAttribute('href', '/admin/cabinet');
    expect(within(preflight).getByRole('link', { name: /1 upcoming event missing location/ })).toHaveAttribute('href', '/admin/events');
    expect(within(preflight).getByText(/diagnostic only/)).toBeInTheDocument();
  });

  it('points Cabinet at the rollover while a draft roster is in progress', async () => {
    renderDashboard(() => Promise.resolve({ ...inputs, cabinet: { ...inputs.cabinet!, rollover: { yearLabel: '2027–28', status: 'draft', positions: 19, filled: 15 } } }));
    const cabinet = await screen.findByRole('region', { name: 'Cabinet' });
    expect(within(cabinet).getByRole('link', { name: /Cabinet rollover/ })).toHaveAttribute('href', '/admin/cabinet/rollover');
    expect(within(cabinet).getByText(/2027–28 rollover/)).toBeInTheDocument();
  });

  it('says a section could not load instead of showing zeros', async () => {
    renderDashboard(() => Promise.resolve({ ...inputs, ace: null }));
    const ace = await screen.findByRole('region', { name: 'ACE' });
    expect(within(ace).getByText(/Could not load this section/)).toBeInTheDocument();
    expect(within(ace).queryByText('0 / 0')).not.toBeInTheDocument();
  });

  it('degrades to a quiet message when everything fails to load', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    renderDashboard(() => Promise.reject(new Error('down')));
    expect(await screen.findByText(/Could not load operations status/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Start/ })).toBeInTheDocument();
  });
});
