import axiosInstance from '../config/axiosInstance';

// Best-effort client error reporting. Swallow failures so reporting can never
// recurse or break the app.
export function reportClientError(payload: Record<string, unknown>) {
    axiosInstance.post('/client-errors', payload).catch(() => {
        // Silently fail to avoid infinite reporting loops
    });
}

export function setupErrorReporting() {
    window.addEventListener('error', (event) => {
        reportClientError({
            message: event.message,
            source: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error ? event.error.stack : null,
            url: window.location.href,
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        reportClientError({
            message: 'Unhandled Promise Rejection',
            reason: event.reason instanceof Error ? event.reason.stack : event.reason,
            url: window.location.href,
        });
    });
}
