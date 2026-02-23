import axiosInstance from "../config/axiosInstance";

/**
 * Utility to manage PWA Push Notifications
 */

// Converts VAPID public key to a Uint8Array
function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export const pushNotifications = {
    /**
     * Check if push notifications are supported and permitted
     */
    async checkStatus() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            return 'unsupported';
        }
        return Notification.permission;
    },

    /**
     * Request permission and subscribe to push notifications
     */
    async subscribe() {
        try {
            // 1. Get VAPID public key from backend
            const { data: { publicKey } } = await axiosInstance.get('/auth/push-config');
            if (!publicKey) throw new Error('VAPID public key not found');

            // 2. Request permission
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return null;

            // 3. Get Service Worker registration
            const registration = await navigator.serviceWorker.ready;

            // 4. Subscribe to Push Manager
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            });

            // 5. Send subscription to backend
            await axiosInstance.post('/auth/push-subscribe', subscription);

            return subscription;
        } catch (error) {
            console.error('Failed to subscribe to push notifications:', error);
            throw error;
        }
    },

    /**
     * Unsubscribe from push notifications
     */
    async unsubscribe() {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                // Remove from backend first
                await axiosInstance.post(`/auth/push-unsubscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`);
                // Then unsubscribe locally
                await subscription.unsubscribe();
            }
        } catch (error) {
            console.error('Failed to unsubscribe from push notifications:', error);
            throw error;
        }
    }
};
