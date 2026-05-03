import React from "react";
import { logError } from "./errorLogger";

type Props = { children: React.ReactNode };
type State = { crashed: boolean };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { crashed: false };

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logError(error, `ErrorBoundary: ${info.componentStack?.split("\n")[1]?.trim() ?? "unknown"}`);
  }

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  render() {
    if (this.state.crashed) {
      return (
        <div className="min-h-screen flex items-center justify-center text-muted-foreground">
          Something went wrong. Please refresh the page.
        </div>
      );
    }
    return this.props.children;
  }
}
