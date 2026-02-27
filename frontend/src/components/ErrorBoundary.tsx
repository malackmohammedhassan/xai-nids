import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-64 gap-5 text-center px-8">
          <AlertOctagon size={52} className="text-red-400 opacity-80" />
          <div>
            <p className="text-gray-200 font-semibold text-lg">Unexpected Error</p>
            <p className="text-gray-400 text-sm mt-1 max-w-sm">
              {this.state.error?.message ?? 'An unknown error occurred'}
            </p>
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: undefined });
              window.location.reload();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
          >
            <RefreshCw size={14} />
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
