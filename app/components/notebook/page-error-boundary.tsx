import { Component, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorCard } from "~/components/notebook/error-card";

/**
 * A page that crashes shows a card in its place; the menu, the tab bar and
 * More keep working (before, a crash took the whole screen down to a bare
 * error page). Reset by `resetKey` (the path), so moving on clears it.
 */
class Boundary extends Component<
  { resetKey: string; fallback: (retry: () => void) => ReactNode; children: ReactNode },
  { failed: boolean; key: string }
> {
  state = { failed: false, key: this.props.resetKey };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  static getDerivedStateFromProps(
    props: { resetKey: string },
    state: { failed: boolean; key: string },
  ) {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null;
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Page crashed", error, info.componentStack);
  }

  retry = () => this.setState({ failed: false });

  render() {
    return this.state.failed ? this.props.fallback(this.retry) : this.props.children;
  }
}

export function PageErrorBoundary({ resetKey, children }: { resetKey: string; children: ReactNode }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return (
    <Boundary
      resetKey={resetKey}
      fallback={(retry) => (
        <div className="p-4 sm:p-6">
          <ErrorCard
            title={t("errors.pageTitle", "This page didn't load properly")}
            body={t("errors.pageBody", "Your data is safe. Try again, or go back to Today.")}
            onRetry={() => {
              void queryClient.invalidateQueries({ refetchType: "active" });
              retry();
            }}
          />
        </div>
      )}
    >
      {children}
    </Boundary>
  );
}
