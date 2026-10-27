import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import React from 'react';
import { useGallery, useGalleryStats, useGalleryYears, useGalleryFilteredCount } from './useGallery';
import { galleryRepository } from '../data/repos/gallery';

jest.mock('../data/repos/gallery', () => ({
  galleryRepository: {
    getAlbumPage: jest.fn(),
    getAlbumCount: jest.fn(),
    getAlbumYears: jest.fn(),
    getFilteredAlbumCount: jest.fn(),
  },
  GALLERY_PAGE_SIZE: 12,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useGallery hook (Issue #561 & #562)', () => {
  it('requests initial page with null cursor and configured limit', async () => {
    (galleryRepository.getAlbumPage as jest.Mock).mockResolvedValueOnce({
      albums: [{ id: 'alb-1', title: 'Test Album' }],
      nextCursor: { date: '2026-10-01', id: 'alb-1' },
    });

    const { result } = renderHook(() => useGallery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(galleryRepository.getAlbumPage).toHaveBeenCalledWith({
      limit: 12,
      cursor: null,
      search: '',
    });
    expect(result.current.hasNextPage).toBe(true);
  });

  it('passes academic year date bounds and search term when options provided', async () => {
    (galleryRepository.getAlbumPage as jest.Mock).mockResolvedValueOnce({
      albums: [],
      nextCursor: null,
    });

    const { result } = renderHook(
      () => useGallery({ year: 2025, search: 'retreat' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(galleryRepository.getAlbumPage).toHaveBeenCalledWith({
      limit: 12,
      cursor: null,
      date_from: '2025-09-01',
      date_to: '2026-08-31',
      search: 'retreat',
    });
  });

  it('nextCursor null indicates hasNextPage is false', async () => {
    (galleryRepository.getAlbumPage as jest.Mock).mockResolvedValueOnce({
      albums: [{ id: 'alb-1', title: 'Test Album' }],
      nextCursor: null,
    });

    const { result } = renderHook(() => useGallery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.hasNextPage).toBe(false);
  });
});
