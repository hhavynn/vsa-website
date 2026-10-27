import { act, fireEvent, render, screen } from '@testing-library/react';
import { GalleryLoadMore } from './GalleryLoadMore';

describe('GalleryLoadMore (Issue #563)', () => {
  let observerCallback: IntersectionObserverCallback;
  let observeMock: jest.Mock;
  let disconnectMock: jest.Mock;

  beforeEach(() => {
    observeMock = jest.fn();
    disconnectMock = jest.fn();

    window.IntersectionObserver = jest.fn().mockImplementation((cb) => {
      observerCallback = cb;
      return {
        observe: observeMock,
        disconnect: disconnectMock,
        unobserve: jest.fn(),
      };
    }) as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders quiet end-of-list message when exhausted', () => {
    render(
      <GalleryLoadMore
        hasNextPage={false}
        isFetchingNextPage={false}
        fetchNextPage={jest.fn()}
        nextPageError={null}
        totalLoaded={24}
      />
    );

    expect(screen.getByText(/You've reached the end of the memory wall/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('renders inline error message with retry button on page 2+ error', () => {
    const fetchNextPage = jest.fn();
    render(
      <GalleryLoadMore
        hasNextPage={true}
        isFetchingNextPage={false}
        fetchNextPage={fetchNextPage}
        nextPageError={new Error('Connection timed out')}
        totalLoaded={12}
      />
    );

    expect(screen.getByText(/Could not load more memories/i)).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /retry loading memories/i });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('renders manual Load More button and triggers fetch on click', () => {
    const fetchNextPage = jest.fn();
    render(
      <GalleryLoadMore
        hasNextPage={true}
        isFetchingNextPage={false}
        fetchNextPage={fetchNextPage}
        nextPageError={null}
        totalLoaded={12}
      />
    );

    const button = screen.getByRole('button', { name: /load more memories/i });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('triggers progressive fetch when sentinel intersects', () => {
    const fetchNextPage = jest.fn();
    render(
      <GalleryLoadMore
        hasNextPage={true}
        isFetchingNextPage={false}
        fetchNextPage={fetchNextPage}
        nextPageError={null}
        totalLoaded={12}
      />
    );

    expect(observeMock).toHaveBeenCalled();

    // Trigger observer callback
    act(() => {
      observerCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('pauses auto-fetch after 2 consecutive auto-bursts until user scrolls or clicks', () => {
    const fetchNextPage = jest.fn();
    const { rerender } = render(
      <GalleryLoadMore
        hasNextPage={true}
        isFetchingNextPage={false}
        fetchNextPage={fetchNextPage}
        nextPageError={null}
        totalLoaded={12}
      />
    );

    // Burst 1
    act(() => {
      observerCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });
    expect(fetchNextPage).toHaveBeenCalledTimes(1);

    // Burst 2
    act(() => {
      observerCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });
    expect(fetchNextPage).toHaveBeenCalledTimes(2);

    // Burst 3: should be paused
    act(() => {
      observerCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });
    // fetchNextPage should NOT have been called a third time
    expect(fetchNextPage).toHaveBeenCalledTimes(2);

    // Simulate user scroll event -> resets guard
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    rerender(
      <GalleryLoadMore
        hasNextPage={true}
        isFetchingNextPage={false}
        fetchNextPage={fetchNextPage}
        nextPageError={null}
        totalLoaded={24}
      />
    );

    // Now auto-fetch works again
    act(() => {
      observerCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });
    expect(fetchNextPage).toHaveBeenCalledTimes(3);
  });

  it('shows accessible loading state while isFetchingNextPage is true', () => {
    render(
      <GalleryLoadMore
        hasNextPage={true}
        isFetchingNextPage={true}
        fetchNextPage={jest.fn()}
        nextPageError={null}
        totalLoaded={12}
      />
    );

    expect(screen.getByText(/loading more memories/i)).toBeInTheDocument();
  });
});
