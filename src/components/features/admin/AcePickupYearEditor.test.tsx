import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AceFamilyMember } from '../../../types';
import type { AcePickupEvidenceRow } from '../../../data/repos/aceFamilies';
import { aceFamiliesRepository } from '../../../data/repos/aceFamilies';
import { AcePickupYearEditor } from './AcePickupYearEditor';
import { acePickupYearSchema } from '../../../schemas';
import { DatabaseError } from '../../../data/errors';

jest.mock('../../../data/repos/aceFamilies', () => ({
  aceFamiliesRepository: { correctPickupYear: jest.fn() },
}));

const correction = aceFamiliesRepository.correctPickupYear as jest.Mock;
const node = (id: string, extra: Partial<AceFamilyMember> = {}): AceFamilyMember => ({
  id, family_id: 'fictional-family', name: 'Fictional ' + id,
  role_label: 'Little', photo_url: 'https://assets.example.invalid/photo.png',
  member_id: 'fictional-member-id', parent_member_id: 'fictional-big', display_order: 1,
  is_published: true, created_at: '', updated_at: '',
  pickup_academic_year_start: null, pickup_term: null, ...extra,
});
const big = node('big', {
  pickup_academic_year_start: 2020, pickup_term: 'FA20', parent_member_id: null,
});
const little = node('little', { parent_member_id: 'target', pickup_academic_year_start: 2024, pickup_term: 'FA24' });
const base = node('target', { name: 'Fictional Target', pickup_academic_year_start: 2022, pickup_term: null });
const example = (id: string, year: number, term: string | null): AcePickupEvidenceRow => ({
  id, ace_member_id: base.id, source_kind: 'official_pairing',
  source_label: 'Fictional sheet', raw_value: term ?? String(year),
  candidate_academic_year_start: year, candidate_term: term,
  review_status: 'pending', reviewed_at: null,
});
function mount(extra: {
  member?: AceFamilyMember; evidence?: AcePickupEvidenceRow[]; ready?: boolean;
  onSaved?: jest.Mock; onConflict?: jest.Mock;
} = {}) {
  const onSaved = extra.onSaved ?? jest.fn().mockResolvedValue(undefined);
  const onConflict = extra.onConflict ?? jest.fn().mockResolvedValue(undefined);
  const view = render(<AcePickupYearEditor member={extra.member ?? base} familyName="Fictional Fam"
    big={big} littles={[little]} familyYears={[2020, 2022, 2024]}
    evidence={extra.evidence ?? []} ready={extra.ready ?? true}
    onSaved={onSaved} onConflict={onConflict} />);
  fireEvent.click(screen.getByRole('button', { name: /Review pickup year/ }));
  return { ...view, onSaved, onConflict };
}
beforeEach(() => {
  jest.clearAllMocks();
  correction.mockResolvedValue({
    changed: true, ace_member_id: base.id,
    previous: { academic_year_start: 2022, term: null },
    current: { academic_year_start: 2023, term: 'FA23' },
  });
});

it('shows approved year-only and read-only Fam, Big, Littles context', () => {
  mount();
  expect(screen.getByText(/Current approved: 2022–23 \(term unknown\)/)).toBeInTheDocument();
  expect(screen.getByText(/Fam: Fictional Fam/)).toBeInTheDocument();
  expect(screen.getByText(/Big: Fictional big/)).toBeInTheDocument();
  expect(screen.getByText(/Littles: Fictional little/)).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Pickup academic year' })).toHaveValue('2022–23');
  expect(screen.getByRole('combobox', { name: 'Exact pickup term (optional)' })).toHaveValue('');
});

it('validates 2023–24 + Fall into exact FA23 and sends only CAS RPC after confirmation', async () => {
  const { onSaved } = mount();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pickup academic year' }), { target: { value: '2023–24' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Exact pickup term (optional)' }), { target: { value: 'FA' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review and save year' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirm pickup-year correction' });
  expect(within(dialog).getByText(/FA23 · 2023–24/)).toBeInTheDocument();
  expect(correction).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm audited correction' }));
  await waitFor(() => expect(correction).toHaveBeenCalledTimes(1));
  expect(correction.mock.calls[0][0]).toEqual({
    nodeId: 'target',
    expected: { academicYearStart: 2022, term: null },
    next: { academicYearStart: 2023, term: 'FA23' },
    sourceKind: 'admin_entry',
    evidenceId: null,
  });
  expect(onSaved).toHaveBeenCalledTimes(1);
});

it('never accepts bare calendar years, legacy or blank as an academic year', async () => {
  mount({ member: node('unknown', { pickup_academic_year_start: null }) });
  const input = screen.getByRole('combobox', { name: 'Pickup academic year' });
  const submit = screen.getByRole('button', { name: 'Review and save year' });
  for (const invalid of ['2021', 'legacy', '']) {
    fireEvent.change(input, { target: { value: invalid } });
    expect(submit).toBeDisabled();
  }
  expect(correction).not.toHaveBeenCalled();
});

it('requires explicit confirmation before clearing an approved year to Unknown', async () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Set to Unknown…' }));
  const dialog = screen.getByRole('alertdialog', { name: 'Set pickup year to Unknown?' });
  expect(correction).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm Unknown' }));
  await waitFor(() => expect(correction).toHaveBeenCalledTimes(1));
  expect(correction.mock.calls[0][0]).toEqual({
    nodeId: 'target', expected: { academicYearStart: 2022, term: null },
    next: { academicYearStart: null, term: null }, sourceKind: 'admin_entry', evidenceId: null,
  });
});

it('uses a pending source candidate exactly and never approves a changed candidate', async () => {
  mount({ evidence: [example('fictional-evidence', 2023, 'FA23')] });
  fireEvent.click(screen.getByRole('button', { name: 'Use candidate' }));
  expect(screen.getByRole('combobox', { name: 'Pickup academic year' })).toHaveValue('2023–24');
  expect(screen.getByRole('combobox', { name: 'Exact pickup term (optional)' })).toHaveValue('FA');
  expect(screen.getByRole('combobox', { name: 'Evidence/source category' })).toHaveValue('official_pairing');
  fireEvent.click(screen.getByRole('button', { name: 'Review and save year' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirm pickup-year correction' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm audited correction' }));
  await waitFor(() => expect(correction).toHaveBeenCalledTimes(1));
  expect(correction.mock.calls[0][0]).toMatchObject({
    evidenceId: 'fictional-evidence', next: { academicYearStart: 2023, term: 'FA23' },
    sourceKind: 'official_pairing',
  });
});

it('never includes a selected evidence id after the proposed source has been edited', async () => {
  mount({ evidence: [example('fictional-evidence', 2023, 'FA23')] });
  fireEvent.click(screen.getByRole('button', { name: 'Use candidate' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Exact pickup term (optional)' }), { target: { value: 'SP' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review and save year' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirm pickup-year correction' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm audited correction' }));
  await waitFor(() => expect(correction).toHaveBeenCalledTimes(1));
  expect(correction.mock.calls[0][0]).toMatchObject({
    evidenceId: null, next: { academicYearStart: 2023, term: 'SP24' },
  });
});

it('refetches on compare-and-swap conflicts and never retries last-write-wins', async () => {
  correction.mockRejectedValueOnce(new DatabaseError('Someone else changed this pickup year. Refresh and try again.', 'P0001'));
  const { onConflict, onSaved } = mount();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pickup academic year' }), { target: { value: '2023–24' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review and save year' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirm pickup-year correction' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm audited correction' }));
  await waitFor(() => expect(onConflict).toHaveBeenCalledTimes(1));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(/Someone else changed this pickup year/);
  expect(onSaved).not.toHaveBeenCalled();
  expect(correction).toHaveBeenCalledTimes(1);
});

it('disables edits when evidence data is unavailable and shows retained superseded history', () => {
  mount({ ready: false });
  expect(screen.getByRole('alert')).toHaveTextContent(/Corrections are disabled/);
  expect(screen.queryByRole('button', { name: 'Review and save year' })).not.toBeInTheDocument();
  expect(correction).not.toHaveBeenCalled();
});

it('keeps approved term and node context isolated from normal member Save', () => {
  mount({ member: node('approved', { pickup_academic_year_start: 2023, pickup_term: 'FA23' }) });
  expect(screen.getByText(/Current approved: FA23 · 2023–24/)).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Exact pickup term (optional)' })).toHaveValue('FA');
  expect(screen.getByRole('button', { name: 'Review and save year' })).toBeDisabled();
});

it('schema accepts explicit year-only and exact-term choices without guessing a bare year', () => {
  const valid = { year: '2023–24', season: 'FA', sourceKind: 'official_pairing' };
  expect(acePickupYearSchema.safeParse(valid).success).toBe(true);
  expect(acePickupYearSchema.safeParse({ ...valid, year: '2023' }).success).toBe(false);
  expect(acePickupYearSchema.safeParse({ ...valid, year: 'legacy' }).success).toBe(false);
  expect(acePickupYearSchema.safeParse({ ...valid, year: '' }).success).toBe(false);
  expect(acePickupYearSchema.safeParse({ ...valid, sourceKind: 'guess_from_big' }).success).toBe(false);
});

it('does not resubmit an already-committed RPC if the post-save view refresh fails', async () => {
  const onSaved = jest.fn().mockRejectedValue(new Error('synthetic refetch outage'));
  mount({ onSaved });
  fireEvent.change(screen.getByRole('combobox', { name: 'Pickup academic year' }), { target: { value: '2023–24' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review and save year' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirm pickup-year correction' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm audited correction' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(correction).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(screen.getByRole('alert')).toHaveTextContent(/correction was saved, but the family view could not refresh/);
});

it('warns when the proposed Little date precedes the Big without changing lineage', () => {
  mount();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pickup academic year' }), {
    target: { value: '2019–20' },
  });
  expect(screen.getByRole('list', { name: 'Pickup-year warnings' }))
    .toHaveTextContent(/Little dated before Big/);
  expect(correction).not.toHaveBeenCalled();
});

it('retains old approval history as a count and never exposes raw review notes', () => {
  const old = {
    ...example('superseded-one', 2021, 'FA21'),
    review_status: 'superseded' as const,
    review_note: 'PRIVATE_NOT_FOR_UI',
  };
  mount({ evidence: [old] });
  expect(screen.getByText(/1 earlier source approval\(s\) superseded/)).toBeInTheDocument();
  expect(screen.queryByText('PRIVATE_NOT_FOR_UI')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Use candidate' })).not.toBeInTheDocument();
});

it('approves matching pending evidence even when the already-approved year stays unchanged', async () => {
  correction.mockResolvedValueOnce({
    ace_member_id: 'target', changed: false,
    previous: { academic_year_start: 2022, term: null },
    current: { academic_year_start: 2022, term: null },
  });
  mount({ evidence: [example('same-year-evidence', 2022, null)] });
  fireEvent.click(screen.getByRole('button', { name: 'Use candidate' }));
  const save = screen.getByRole('button', { name: 'Review and save year' });
  expect(save).toBeEnabled();
  fireEvent.click(save);
  const dialog = await screen.findByRole('alertdialog', { name: 'Confirm pickup-year correction' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm audited correction' }));
  await waitFor(() => expect(correction).toHaveBeenCalledTimes(1));
  expect(correction.mock.calls[0][0]).toMatchObject({
    expected: { academicYearStart: 2022, term: null },
    next: { academicYearStart: 2022, term: null },
    evidenceId: 'same-year-evidence', sourceKind: 'official_pairing',
  });
  expect(await screen.findByText(/Evidence approval recorded. The approved pickup year is unchanged/)).toBeInTheDocument();
});
