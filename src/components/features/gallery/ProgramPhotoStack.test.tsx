import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ProgramPhotoStack, useProgramHeroMedia } from './ProgramPhotoStack';
import { galleryRepository, type ProgramAlbum } from '../../../data/repos/gallery';
import { supabaseMock } from '../../../test-utils/supabaseMock';

jest.mock('../../../lib/supabase', () => ({
  get supabase() {
    return require('../../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

const album = (over: Partial<ProgramAlbum> = {}): ProgramAlbum => ({
  id: 'album-1',
  title: 'Fictional Culture Night',
  date: '2026-04-18',
  google_photos_url: 'https://photos.app.goo.gl/fictional',
  cover_image_url: '/images/gallery/fictional.webp',
  cover_thumbnail_url: null,
  ...over,
});

describe('getProgramAlbums', () => {
  it('reads only covered albums of published events of the requested types', async () => {
    supabaseMock.setDefault('gallery_events', { data: [album()], error: null });

    await expect(galleryRepository.getProgramAlbums(['vcn'])).resolves.toEqual([album()]);

    const [query] = supabaseMock.queriesFor('gallery_events');
    const select = query.calls.find((c) => c.method === 'select')?.args[0] as string;
    expect(select).toContain('event:events!inner(');
    expect(query.calls).toContainEqual({ method: 'in', args: ['event.event_type', ['vcn']] });
    expect(query.calls).toContainEqual({ method: 'eq', args: ['event.is_published', true] });
    expect(query.calls).toContainEqual({ method: 'not', args: ['cover_image_url', 'is', null] });
    expect(query.calls).toContainEqual({ method: 'limit', args: [2] });
  });

  it('makes no request when no event type is asked for', async () => {
    await expect(galleryRepository.getProgramAlbums([])).resolves.toEqual([]);
    expect(supabaseMock.queriesFor('gallery_events')).toHaveLength(0);
  });
});

describe('ProgramPhotoStack', () => {
  it('links each Polaroid to its album and prefers the thumbnail', () => {
    render(
      <ProgramPhotoStack
        label="VCN photo albums"
        isLoading={false}
        albums={[
          album({ cover_thumbnail_url: '/images/gallery/fictional_thumb.webp' }),
          album({ id: 'album-2', title: 'Fictional Rehearsal', date: '2025-04-12' }),
        ]}
      />,
    );
    const link = screen.getByRole('link', { name: 'Fictional Culture Night photo album (opens Google Photos)' });
    expect(link).toHaveAttribute('href', 'https://photos.app.goo.gl/fictional');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(link).getByAltText('')).toHaveAttribute('src', '/images/gallery/fictional_thumb.webp');
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('never renders an unsafe album link', () => {
    render(
      <ProgramPhotoStack
        label="VCN photo albums"
        isLoading={false}
        albums={[album({ google_photos_url: ['javascript', 'alert(1)'].join(':') })]}
      />,
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', '#');
  });

  it('renders nothing when there are no albums', () => {
    const { container } = render(<ProgramPhotoStack label="x" isLoading={false} albums={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

function HeroMediaProbe() {
  const media = useProgramHeroMedia(['wildn_culture'], "Wild N' Culture photo albums");
  return <div data-testid="probe">{media === undefined ? 'no-media' : media}</div>;
}

function renderProbe() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HeroMediaProbe />
    </QueryClientProvider>,
  );
}

describe('useProgramHeroMedia', () => {
  it('gives the hero no media when the program has no albums, so it keeps its full layout', async () => {
    supabaseMock.setDefault('gallery_events', { data: [], error: null });
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('no-media'));
  });

  it('gives the hero no media when the read fails', async () => {
    supabaseMock.setDefault('gallery_events', { data: null, error: { message: 'down', code: '500' } });
    renderProbe();
    // The hook retries once before settling on the error.
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('no-media'), { timeout: 4000 });
  });

  it('shows the album once it loads', async () => {
    supabaseMock.setDefault('gallery_events', { data: [album({ title: "WNC '26" })], error: null });
    renderProbe();
    expect(
      await screen.findByRole('link', { name: "WNC '26 photo album (opens Google Photos)" }),
    ).toBeInTheDocument();
  });
});
