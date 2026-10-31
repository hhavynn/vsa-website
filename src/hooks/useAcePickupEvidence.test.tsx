import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { useAcePickupEvidence } from './useAceFamilies';

const mockList = jest.fn();
jest.mock('../data/repos/aceFamilies', () => ({
  aceFamiliesRepository: { listPickupEvidenceForFamily: (...args: unknown[]) => mockList(...args) },
}));

function Probe({ familyId }: { familyId: string | null }) {
  const { evidence, ready, loading, error } = useAcePickupEvidence(familyId);
  const state = error ? 'unavailable' : ready ? 'ready:' + evidence.map(row => row.id).join(',')
    : loading ? 'loading' : 'not-ready';
  return <output data-testid="year-evidence-state">{state}</output>;
}

function setup(familyId: string | null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  const renderFor = (id: string | null) => (
    <QueryClientProvider client={client}><Probe familyId={id} /></QueryClientProvider>
  );
  const view = render(renderFor(familyId));
  return { ...view, renderFor };
}

beforeEach(() => mockList.mockReset());

it('never runs a private evidence query with no selected family', () => {
  setup(null);
  expect(screen.getByTestId('year-evidence-state')).toHaveTextContent('not-ready');
  expect(mockList).not.toHaveBeenCalled();
});

it('keys the private evidence by family, not by a shared public ACE query key', async () => {
  mockList.mockImplementation(async (id: string) => [{ id: 'evidence-' + id }]);
  const { rerender, renderFor } = setup('family-a');
  await waitFor(() => expect(screen.getByTestId('year-evidence-state')).toHaveTextContent('ready:evidence-family-a'));
  expect(mockList).toHaveBeenCalledWith('family-a');

  rerender(renderFor('family-b'));
  expect(screen.getByTestId('year-evidence-state')).not.toHaveTextContent('evidence-family-a');
  await waitFor(() => expect(screen.getByTestId('year-evidence-state')).toHaveTextContent('ready:evidence-family-b'));
  expect(mockList).toHaveBeenCalledWith('family-b');
});

it('fails closed after an evidence read denial instead of returning an empty verified result', async () => {
  mockList.mockRejectedValue(new Error('synthetic permission denied'));
  setup('family-a');
  await waitFor(() => expect(screen.getByTestId('year-evidence-state')).toHaveTextContent('unavailable'));
  expect(screen.getByTestId('year-evidence-state')).not.toHaveTextContent('ready:');
});
