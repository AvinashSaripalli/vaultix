import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleDismiss = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center bg-[#f4f6f8] dark:bg-[#0f172a] p-4 select-none">
          <div className="flex flex-col items-center gap-4 text-center max-w-sm w-full p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="h-12 w-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <span className="text-xl font-black">!</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Something went wrong</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                An unexpected error occurred.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="w-full text-left bg-slate-100 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto text-[11px] text-rose-600 dark:text-rose-400 font-mono">
                {String(this.state.error.message)}
              </div>
            )}

            <div className="flex items-center gap-2 w-full mt-2">
              <button
                type="button"
                onClick={this.handleDismiss}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition active:scale-95"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 py-2.5 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition active:scale-95 shadow-md shadow-indigo-600/20"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
