import axiosInstance from '../config/axiosInstance';

export function setupErrorReporting() {
    window.addEventListener('error', (event) => {
        const payload = {
            message: event.message,
            source: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error ? event.error.stack : null,
            url: window.location.href,
        };

        axiosInstance.post('/client-errors', payload).catch(() => {
            // Silently fail if we can't report the error to prevent infinite loops
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        const payload = {
            message: 'Unhandled Promise Rejection',
            reason: event.reason instanceof Error ? event.reason.stack : event.reason,
            url: window.location.href,
        };

        axiosInstance.post('/client-errors', payload).catch(() => {
            // Silently fail
        });
    });
}
