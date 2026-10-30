import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { VCNArchive } from '../types';
import { VCNArchive as VCNArchivePage } from './VcnArchive';

let mockArchives: VCNArchive[] = [];

jest.mock('../hooks/useVcnArchives', () => ({
  usePublishedVcnArchives: () => ({
    archives: mockArchives,
    loading: false,
    error: null,
    refreshArchives: jest.fn(),
  }),
}));

function archive(overrides: Partial<VCNArchive> = {}): VCNArchive {
  return {
    id: 'vcn-2025',
    year: 2025,
    title: 'Vietnamese Culture Night 2025',
    cover_image_url: '/images/vcn/cover.webp',
    cover_thumbnail_url: '/images/vcn/cover_thumb.webp',
    ...overrides,
  } as VCNArchive;
}

function renderArchive() {
  return render(
    <MemoryRouter>
      <VCNArchivePage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockArchives = [];
});

it('uses shared image delivery with reserved dimensions, lazy loading and the published thumbnail', () => {
  mockArchives = [archive()];
  renderArchive();

  const image = screen.getByRole('img', { name: 'Vietnamese Culture Night 2025 cover' });
  expect(image).toHaveAttribute('src', '/images/vcn/cover_thumb.webp');
  expect(image).toHaveAttribute('width', '640');
  expect(image).toHaveAttribute('height', '420');
  expect(image).toHaveAttribute('loading', 'lazy');
  expect(image).toHaveAttribute('decoding', 'async');
});

it('keeps the VCN year and a readable placeholder if a published cover fails', () => {
  mockArchives = [archive()];
  renderArchive();

  fireEvent.error(screen.getByRole('img', { name: 'Vietnamese Culture Night 2025 cover' }));
  expect(screen.queryByRole('img', { name: 'Vietnamese Culture Night 2025 cover' })).not.toBeInTheDocument();
  expect(screen.getByText('2025', { selector: '.font-serif' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Vietnamese Culture Night 2025' })).toBeInTheDocument();
});

it('shows the same fallback when an archive has no cover at all', () => {
  mockArchives = [archive({ cover_image_url: null, cover_thumbnail_url: null })];
  renderArchive();

  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.getByText('2025', { selector: '.font-serif' })).toBeInTheDocument();
});
