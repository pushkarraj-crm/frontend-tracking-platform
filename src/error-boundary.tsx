import { Component, type ReactNode } from "react";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="not-found" role="alert">
        <h1>Let’s reconnect.</h1>
        <p>
          The page encountered an unexpected problem. Reload to restore your
          session.
        </p>
        <button
          className="button primary"
          onClick={() => window.location.reload()}
        >
          Reload application
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
