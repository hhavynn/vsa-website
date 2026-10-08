
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { PageError } from "./PageError";
import { isChunkLoadError, reloadOnceForChunkError } from "../../utils/chunkLoadRecovery";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  reloading?: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // A stale tab asking for a chunk that a newer deploy removed: reload once
    // for the fresh bundle. A repeat inside the window falls through to the UI.
    if (isChunkLoadError(error) && reloadOnceForChunkError()) {
      this.setState({ reloading: true });
      return;
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
    // A rejected React.lazy import is cached, so re-rendering can never succeed.
    if (isChunkLoadError(this.state.error)) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      if (this.state.reloading) {
        return null;
      }

      if (this.props.fallback) {
        return this.props.fallback;
      }

      const chunkError = isChunkLoadError(this.state.error);

      return (
        <PageError
          error={this.state.error}
          resetError={this.handleReset}
          title={chunkError ? "Page update needed" : "Application Error"}
          message={
            chunkError
              ? "The site was updated while this page was open. Reload to get the latest version."
              : "Something went wrong. Please try refreshing the page or contact support if the problem persists."
          }
        />
      );
    }

    return this.props.children;
  }
} 