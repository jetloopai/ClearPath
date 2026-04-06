"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
          <p className="font-serif italic text-4xl text-foreground mb-2">ClearPath</p>
          <h1 className="text-2xl font-light text-zinc-300 mb-3">Something went wrong</h1>
          <p className="text-sm text-zinc-500 mb-8 max-w-sm">
            An unexpected error occurred. Your data is safe — try reloading or going back to the home page.
          </p>
          <a
            href="/"
            className="px-6 py-3 rounded-full bg-foreground text-background text-sm font-medium hover:bg-zinc-200 transition-colors"
          >
            Go Home
          </a>
        </div>
      );
    }

    return this.props.children;
  }
}
