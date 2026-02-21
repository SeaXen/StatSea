import logging
from datetime import datetime

import numpy as np
from sklearn.linear_model import LinearRegression
from sqlalchemy import desc

from ..db.database import SessionLocal
from ..models.models import Device, DeviceDailySummary, SystemDailySummary

logger = logging.getLogger("AIPredictor")


class AIPredictor:
    """
    Local AI Predictor for bandwidth usage.
    Uses simple linear regression for forecasting and statistical Z-score for anomalies.
    """

    def predict_total_usage(self) -> dict:
        """
        Predicts total network usage for the current month.
        Returns: { 'predicted_bytes': int, 'confidence': float, 'trend': str }
        """
        db = SessionLocal()
        try:
            # Fetch last 30 days of summaries
            summaries = (
                db.query(SystemDailySummary).order_by(desc(SystemDailySummary.date)).limit(30).all()
            )
            if len(summaries) < 3:
                return {"error": "Insufficient data"}

            # Prepare data
            data = []
            for s in reversed(summaries):
                total = s.bytes_sent + s.bytes_recv
                data.append(total)

            # Simple Linear Regression
            X = np.array(range(len(data))).reshape(-1, 1)
            y = np.array(data)
            model = LinearRegression()
            model.fit(X, y)

            # Predict for the rest of the month
            today = datetime.now()
            days_in_month = 30  # Simplified
            remaining_days = days_in_month - today.day

            if remaining_days <= 0:
                return {"predicted_bytes": int(data[-1]), "trend": "End of month"}

            # Future indices
            future_X = np.array(range(len(data), len(data) + remaining_days)).reshape(-1, 1)
            predictions = model.predict(future_X)

            projected_remaining = sum(predictions)
            current_month_usage = sum(data[: today.day]) if len(data) >= today.day else sum(data)

            total_predicted = int(current_month_usage + projected_remaining)

            trend = "up" if model.coef_[0] > 0 else "down"

            return {
                "predicted_bytes": total_predicted,
                "current_usage": int(current_month_usage),
                "trend": trend,
                "growth_rate_pct": float(model.coef_[0] / np.mean(y) * 100)
                if np.mean(y) > 0
                else 0,
            }
        except Exception as e:
            logger.error(f"Prediction error: {e}")
            return {"error": str(e)}
        finally:
            db.close()

    def detect_anomalies(self, organization_id: int = None) -> list[dict]:
        """
        Detects devices with unusual bandwidth consumption profiles.
        Scoped to the given organization_id to prevent cross-tenant data leakage.
        """
        db = SessionLocal()
        anomalies = []
        try:
            # Scope query to the organization
            query = db.query(Device)
            if organization_id is not None:
                query = query.filter(Device.organization_id == organization_id)
            devices = query.all()
            for dev in devices:
                summaries = (
                    db.query(DeviceDailySummary)
                    .filter(DeviceDailySummary.device_id == dev.id)
                    .order_by(desc(DeviceDailySummary.date))
                    .limit(14)
                    .all()
                )

                if len(summaries) < 7:
                    continue

                usage = [s.upload_bytes + s.download_bytes for s in summaries]
                current = usage[0]
                history = usage[1:]

                avg = np.mean(history)
                std = np.std(history)

                if std == 0:
                    continue

                z_score = (current - avg) / std

                if z_score > 3:  # 3 standard deviations is a strong anomaly
                    anomalies.append(
                        {
                            "device_mac": dev.mac_address,
                            "device_name": dev.nickname or dev.hostname or dev.mac_address,
                            "severity": "HIGH",
                            "current_usage": current,
                            "avg_usage": avg,
                            "z_score": float(z_score),
                        }
                    )

            return anomalies
        except Exception as e:
            logger.error(f"Anomaly detection error: {e}")
            return []
        finally:
            db.close()


ai_predictor = AIPredictor()
