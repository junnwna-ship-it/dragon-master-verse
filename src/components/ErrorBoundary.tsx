import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Label shown above the error so users know which area failed. */
  label?: string;
}

interface State {
  error: Error | null;
}

/**
 * Local ErrorBoundary so a single view's render failure doesn't bubble up to
 * the router-level DefaultErrorComponent (which hides the actual cause behind
 * a generic "Something went wrong" message). Shows the real error inline.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Always log — production users can copy/paste this back to us.
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ""}]`, error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-2xl border border-rose-700/60 bg-rose-950/40 p-4 text-rose-200">
          <p className="text-sm font-bold">
            ⚠️ {this.props.label ?? "화면"}을 표시하는 중 오류가 발생했습니다
          </p>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-black/40 p-2 text-[11px] font-mono text-rose-100">
            {this.state.error.message}
            {this.state.error.stack ? `\n\n${this.state.error.stack}` : ""}
          </pre>
          <button
            type="button"
            onClick={this.reset}
            className="mt-3 rounded-md bg-rose-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-400"
          >
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}