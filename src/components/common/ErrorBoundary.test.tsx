import React from 'react';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';
import { reportError } from '../../lib/monitoring';

jest.mock('../../lib/monitoring', () => ({ reportError: jest.fn() }));

function Boom({ error }: { error: Error }): React.ReactElement {
  throw error;
}

function chunkError(): Error {
  const error = new Error('Loading chunk 7 failed.');
  error.name = 'ChunkLoadError';
  return error;
}

describe('ErrorBoundary', () => {
  const reload = jest.fn();
  const originalLocation = window.location;

  beforeEach(() => {
    reload.mockClear();
    (reportError as jest.Mock).mockClear();
    window.sessionStorage.clear();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, reload } });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    jest.restoreAllMocks();
  });

  it('reloads exactly once for a stale chunk and renders nothing while it does', () => {
    const { container } = render(
      <ErrorBoundary>
        <Boom error={chunkError()} />
      </ErrorBoundary>,
    );

    expect(reload).toHaveBeenCalledTimes(1);
    expect(container).toBeEmptyDOMElement();
    expect(reportError).not.toHaveBeenCalled();
  });

  it('does not reload again inside the window and shows an update prompt that reloads on retry', () => {
    window.sessionStorage.setItem('chunkReloadAt', String(Date.now()));

    render(
      <ErrorBoundary>
        <Boom error={chunkError()} />
      </ErrorBoundary>,
    );

    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByText('Page update needed')).toBeInTheDocument();

    screen.getByRole('button', { name: 'Try Again' }).click();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('shows the normal fallback for ordinary errors without reloading', () => {
    render(
      <ErrorBoundary>
        <Boom error={new TypeError("Cannot read properties of undefined (reading 'map')")} />
      </ErrorBoundary>,
    );

    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByText('Application Error')).toBeInTheDocument();
    expect(reportError).toHaveBeenCalledWith(expect.any(TypeError), expect.any(String));
  });
});
