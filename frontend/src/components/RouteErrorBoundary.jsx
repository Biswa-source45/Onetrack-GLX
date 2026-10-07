import { Component } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

// Catches a render crash inside one dashboard page so the sidebar and header
// survive and the user sees what broke, instead of the whole app going
// white. Dashboard keys it by pathname, so navigating anywhere resets it.
export class RouteErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Page crashed:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto mt-10 flex max-w-lg flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-10 text-center shadow-sm">
        <AlertTriangle className="size-6 text-destructive" aria-hidden />
        <p className="text-sm font-semibold text-foreground">Something went wrong on this page</p>
        <p className="break-words text-xs text-muted-foreground">{String(this.state.error?.message || this.state.error)}</p>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.location.reload()}>
          <RotateCw className="size-3.5" /> Reload page
        </Button>
      </div>
    );
  }
}
