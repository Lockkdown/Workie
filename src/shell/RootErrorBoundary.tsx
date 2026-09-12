/**
 * Root error chrome [D91]. Not a destination [D81]. Does not touch task status [D4].
 */
import { Component, type ReactNode } from "react";
import { Button } from "../ui/Button";

/** English UI copy for the root error state [D78]. */
export const COPY = {
  dataKept:
    "All task, block and cycle data stays safe in IndexedDB. Nothing was lost.",
  reload: "Reload",
} as const;

export function rootErrorCause(error: unknown): string {
  if (error instanceof Error && error.message !== "") {
    return error.message;
  }
  if (typeof error === "string" && error !== "") {
    return error;
  }
  return "An unexpected error occurred.";
}

type RootErrorStateProps = {
  cause: string;
  onReload?: () => void;
};

export function RootErrorState({ cause, onReload }: RootErrorStateProps) {
  return (
    <div className="root-error" data-state="error">
      <div role="alert">
        <p className="type-body-m">{cause}</p>
        <p className="type-body-s">{COPY.dataKept}</p>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="primary"
        onClick={onReload ?? (() => window.location.reload())}
      >
        {COPY.reload}
      </Button>
    </div>
  );
}

type RootErrorBoundaryProps = {
  children: ReactNode;
  onReload?: () => void;
};

type RootErrorBoundaryState = {
  error: unknown;
};

export class RootErrorBoundary extends Component<
  RootErrorBoundaryProps,
  RootErrorBoundaryState
> {
  state: RootErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): RootErrorBoundaryState {
    return { error };
  }

  render(): ReactNode {
    if (this.state.error != null) {
      return (
        <RootErrorState
          cause={rootErrorCause(this.state.error)}
          onReload={this.props.onReload}
        />
      );
    }
    return this.props.children;
  }
}
