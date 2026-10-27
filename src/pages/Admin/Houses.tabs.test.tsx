import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import AdminHouses from './Houses';

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { error: jest.fn(), success: jest.fn() }, Toaster: () => null }));
jest.mock('../../hooks/useAcademicTerms', () => ({ useAcademicTerms: () => ({ terms: [] }) }));
jest.mock('../../data/repos/memberLookup', () => ({ memberLookupRepository: { listHouseImportMembers: jest.fn().mockResolvedValue([]) } }));
jest.mock('../../lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order']) chain[method] = () => chain;
  chain.then = (resolve: (value: unknown) => void) => resolve({ data: [], error: null });
  return { supabase: { from: () => chain } };
});
jest.mock('../../components/features/admin/HouseDraftWorkflow', () => {
  const { createElement } = require('react');
  const { useLocation } = require('react-router-dom');
  return { HouseDraftWorkflow: () => createElement('p', null, `assignments workflow ${useLocation().search}`) };
});
jest.mock('../../components/features/admin/HouseImagesManager', () => ({
  HouseImagesManager: () => require('react').createElement('p', null, 'images manager'),
}));
jest.mock('../../components/features/admin/HouseParentLinks', () => ({ HouseParentLinks: () => null }));
jest.mock('../../components/features/admin/HouseEventsManager', () => ({
  HouseEventsManager: () => require('react').createElement('p', null, 'events manager'),
}));

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{pathname + search}</p>;
}

function renderHouses(entry = '/admin/houses') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AdminHouses />
      <Where />
    </MemoryRouter>,
  );
}

const tab = (name: string) => screen.getByRole('tab', { name: new RegExp(name) });

describe('Admin Houses task tabs', () => {
  it('lands on House Assignments, the primary task, by default', () => {
    renderHouses();
    expect(tab('House Assignments')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/assignments workflow/)).toBeInTheDocument();
  });

  it('keeps existing batch/row draft deep links on the assignments tab', () => {
    renderHouses('/admin/houses?batch=b1&row=r1');
    expect(tab('House Assignments')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/assignments workflow \?batch=b1&row=r1/)).toBeInTheDocument();
  });

  it.each([
    ['images', 'Profiles & Images', /images manager/],
    ['events', 'House Events', /events manager/],
    ['backfill', 'Historical Backfill', /Legacy Backfill from members\.house/],
  ])('opens the %s tab straight from the URL', (param, label, content) => {
    renderHouses(`/admin/houses?tab=${param}`);
    expect(tab(label)).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(content)).toBeInTheDocument();
  });

  it('falls back to assignments for an unknown tab', () => {
    renderHouses('/admin/houses?tab=nope');
    expect(tab('House Assignments')).toHaveAttribute('aria-selected', 'true');
  });

  it('writes the chosen tab into the URL, and drops draft params when leaving assignments', () => {
    renderHouses('/admin/houses?batch=b1&row=r1');
    fireEvent.click(tab('Profiles & Images'));
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/houses?tab=images');

    fireEvent.click(tab('House Assignments'));
    expect(screen.getByTestId('where').textContent).toBe('/admin/houses');
  });

  it('labels the historical backfill as advanced', () => {
    renderHouses();
    expect(tab('Historical Backfill')).toHaveTextContent('Advanced');
  });
});
