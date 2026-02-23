import json
import logging
from pywebpush import webpush, WebPushException
from app.core.config import settings

logger = logging.getLogger(__name__)

class WebPushService:
    @staticmethod
    def send_push_notification(subscription_info: str, data: dict):
        """
        Sends a push notification to a client.
        subscription_info: JSON string containing endpoint and keys
        data: dictionary containing notification payload
        """
        if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
            logger.warning("VAPID keys are not configured. Cannot send push notifications.")
            return False

        try:
            subscription_data = json.loads(subscription_info)
            webpush(
                subscription_info=subscription_data,
                data=json.dumps(data),
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={
                    "sub": f"mailto:{settings.VAPID_ADMIN_EMAIL}"
                }
            )
            return True
        except WebPushException as ex:
            logger.error(f"Failed to send push notification: {ex}")
            # If the error is 410 Gone or 404 Not Found, the subscription is no longer valid
            if ex.response is not None and ex.response.status_code in [404, 410]:
                logger.info("Subscription has expired or is invalid.")
                # We should ideally return a specific code to the caller to remove this subscription
            return False
        except Exception as ex:
            logger.error(f"An unexpected error occurred while sending push: {ex}")
            return False

    @staticmethod
    def generate_vapid_keys():
        """Generates a new pair of VAPID keys if none exist."""
        # This requires the pywebpush command line tool or a manual call
        # For now, we recommend users generate them via:
        # vapid --gen
        # Or provide a utility function in the future.
        pass

webpush_service = WebPushService()
