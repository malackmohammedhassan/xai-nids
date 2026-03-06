import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RefreshCw, Copy, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  stack?: string;
  showDetail: boolean;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, showDetail: false, copied: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    this.setState({ stack: info.componentStack ?? error.stack ?? '' });
  }

  private handleCopy = () => {
    const text = `${this.state.error?.message ?? ''}\n\n${this.state.stack ?? ''}`;
    navigator.clipboard.writeText(text).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  render() {
    if (this.state.hasError) {
      const { showDetail, copied, error, stack } = this.state;
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-64 gap-5 text-center px-8">
          <AlertOctagon size={52} className="text-red-400 opacity-80" />
          <div>
            <p className="text-gray-200 font-semibold text-lg">Unexpected Error</p>
            <p className="text-gray-400 text-sm mt-1 max-w-sm">
              {error?.message ?? 'An unknown error occurred'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: undefined, stack: undefined });
                window.location.reload();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
            >
              <RefreshCw size={14} />
              Reload Page
            </button>

            <button
              onClick={this.handleCopy}
              title="Copy error details"
              className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
            >
              <Copy size={14} />
              {copied ? 'Copied!' : 'Copy Error'}
            </button>

            {stack && (
              <button
                onClick={() => this.setState((s) => ({ showDetail: !s.showDetail }))}
                className="flex items-center gap-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded-lg transition-colors"
              >
                {showDetail ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Details
              </button>
            )}
          </div>

          {showDetail && stack && (
            <pre className="text-left text-xs text-gray-500 bg-gray-900 border border-gray-700 rounded p-3 max-w-xl max-h-48 overflow-auto whitespace-pre-wrap">
              {stack}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

