import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, Home, RefreshCcw } from "lucide-react";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    private handleReset = () => {
        this.setState({ hasError: false });
        window.location.href = "/";
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-6">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/10 text-red-500 mb-2">
                            <AlertTriangle size={40} />
                        </div>

                        <div className="space-y-2">
                            <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
                            <p className="text-slate-400 text-sm">
                                An unexpected error occurred in the application. We've been notified and are working on it.
                            </p>
                        </div>

                        {this.state.error && (
                            <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3 text-left overflow-auto max-h-32">
                                <code className="text-xs text-red-400 font-mono">
                                    {this.state.error.message}
                                </code>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => window.location.reload()}
                                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-white rounded-xl font-medium transition-colors"
                            >
                                <RefreshCcw size={18} />
                                Refresh Page
                            </button>
                            <button
                                onClick={this.handleReset}
                                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                            >
                                <Home size={18} />
                                Back to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.children;
    }
}

export default ErrorBoundary;
