"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type ClientWidgetBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
  widgetName?: string;
};

type ClientWidgetBoundaryState = {
  hasError: boolean;
};

export class ClientWidgetBoundary extends Component<
  ClientWidgetBoundaryProps,
  ClientWidgetBoundaryState
> {
  state: ClientWidgetBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Client widget boundary triggered for ${this.props.widgetName || "widget"}.`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }

    return this.props.children;
  }
}
