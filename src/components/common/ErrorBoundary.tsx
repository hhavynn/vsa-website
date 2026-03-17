
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { PageError } from "./PageError";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // ChunkLoadError = browser cached old index.html after a new deploy.
    // Auto-reload once to fetch the fresh bundle — clears itself silently.
    const isChunkError =
      error.name === 'ChunkLoadError' ||
      error.message?.includes('Loading chunk') ||
      error.message?.includes('Failed to fetch dynamically imported module');

    if (isChunkError) {
      // Guard against reload loops: only reload if we haven't just done so
      const lastReload = Number(sessionStorage.getItem('chunkReloadAt') ?? 0);
      if (Date.now() - lastReload > 10_000) {
        sessionStorage.setItem('chunkReloadAt', String(Date.now()));
        window.location.reload();
        return;
      }
    }

    console.error('Uncaught error:', error, errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    if (process.env.NODE_ENV === 'production') {
      console.error('Production error:', { error, errorInfo });
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <PageError
          error={this.state.error}
          resetError={this.handleReset}
          title="Application Error"
          message="Something went wrong. Please try refreshing the page or contact support if the problem persists."
        />
      );
    }

    return this.props.children;
  }
} 