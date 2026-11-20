import asyncio
import operator
import re
from datetime import datetime, timedelta, timezone

import sqlalchemy.exc
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from ..db.database import SessionLocal
from ..models import models
from ..services import (
    backup_service as backup_service_lib,
    health_checker as health_service,
    system_metrics as system_service,
)
from ..services.certificate_service import CertificateMonitor
from ..services.notification_service import NotificationService
from ..services.port_scanner import run_port_scan_job
from .aggregator import run_aggregation_job
from .ai_predictor import ai_predictor
from .cleanup import run_cleanup_job
from .collector import global_collector
from .logging import get_logger
from .metrics import metrics_manager
from .quotas import check_quotas
from .speedtest_service import speedtest_service
from .uptime import check_device_availability

logger = get_logger("Scheduler")


class SchedulerService:
    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self.scheduler.start()
        self.job_id = "auto_speedtest"
        self.cleanup_job_id = "data_cleanup"
        self.quota_job_id = "quota_check"

        # Schedule cleanup daily
        self.schedule_cleanup()

        # Schedule quota check every 15 minutes
        self.schedule_quota_check()

        # Schedule uptime check every 1 minute
        self.schedule_uptime_check()

        # Schedule aggregation every hour
        self.schedule_aggregation()

        # Schedule port scanning every 6 hours
        self.schedule_port_scanning()

        # Phase 6: System Management
        self.schedule_system_metrics()
        self.schedule_health_checks()
        self.schedule_backups()

        # Phase 11: SSL Monitoring
        self.schedule_certificate_checks()

    def schedule_uptime_check(self):
        """Schedules the device uptime/offline check."""
        if not self.scheduler.get_job("uptime_monitor"):
            self.scheduler.add_job(
                check_device_availability,
                "interval",
                minutes=1,
                id="uptime_monitor",
                replace_existing=True,
            )
            logger.info("Uptime monitor scheduled (Every 1 min).")

    def schedule_aggregation(self):
        """Schedules the daily aggregation job."""
        if not self.scheduler.get_job("daily_aggregation"):
            self.scheduler.add_job(
                run_aggregation_job,
                "interval",
                hours=1,
                id="daily_aggregation",
                replace_existing=True,
            )
            logger.info("Daily aggregation scheduled (Every 1 hour).")

    def schedule_port_scanning(self):
        """Schedules the background port scanning job."""
        if not self.scheduler.get_job("port_scanner"):
            # Run every 6 hours
            self.scheduler.add_job(
                run_port_scan_job,
                "interval",
                hours=6,
                id="port_scanner",
                replace_existing=True,
            )
            logger.info("Background port scanner scheduled (Every 6 hours).")

    def schedule_quota_check(self):
        """Schedules the bandwidth quota check."""
        if not self.scheduler.get_job(self.quota_job_id):
            self.scheduler.add_job(
                check_quotas, "interval", minutes=15, id=self.quota_job_id, replace_existing=True
            )
            logger.info("Bandwidth quota check scheduled (Every 15 mins).")

    def schedule_speedtest(self, interval_hours: float = 0):
        """Schedules the speedtest job. If interval_hours is 0, removes the job."""
        if self.scheduler.get_job(self.job_id):
            self.scheduler.remove_job(self.job_id)

        if interval_hours > 0:
            self.scheduler.add_job(
                self.run_scheduled_speedtest, "interval", hours=interval_hours, id=self.job_id
            )
            logger.info(f"Speedtest scheduled every {interval_hours} hours.")
        else:
            logger.info("Speedtest automation disabled.")

    def schedule_cleanup(self):
        """Schedules the daily data cleanup job."""
        if not self.scheduler.get_job(self.cleanup_job_id):
            self.scheduler.add_job(
                run_cleanup_job, "interval", days=1, id=self.cleanup_job_id, replace_existing=True
            )
            logger.info("Data cleanup job scheduled (Daily).")

    def run_scheduled_speedtest(self):
        """Runs the speedtest and sends notifications."""
        logger.info("Running scheduled speedtest...")
        db: Session = SessionLocal()
        try:
            # Run test (using default provider preference from simple logic or settings)
            # For now, we'll default to 'ookla' or fetch from settings if we implement that
            provider = "ookla"

            # Fetch settings for provider and server if needed
            settings = db.query(models.SystemSettings).all()
            settings_map = {s.key: s.value for s in settings}

            provider = settings_map.get("speedtest_provider", "ookla")
            server_id = int(settings_map.get("speedtest_server_id", 0)) or None

            # Run test (Synchronous calls)
            result_data = None
            if provider == "cloudflare":
                result_data = speedtest_service.run_cloudflare_speedtest()
            else:
                result_data = speedtest_service.run_ookla_speedtest(server_id=server_id)

            # Save to Database
            if result_data:
                db_item = models.SpeedtestResult(
                    timestamp=result_data["timestamp"],
                    ping=result_data["ping"],
                    download=result_data["download"],
                    upload=result_data["upload"],
                    server_id=int(result_data["server"]["id"]),
                    server_name=f"{result_data['server']['name']}, {result_data['server']['country']}",
                    server_country=result_data.get("server", {}).get("country", "Unknown"),
                    provider=provider,
                )
                db.add(db_item)
                db.commit()
                db.refresh(db_item)

                # Send Notification
                result_dict = {
                    "download": result_data["download"],
                    "upload": result_data["upload"],
                    "ping": result_data["ping"],
                    "provider": provider,
                    "server_name": result_data["server"]["name"],
                }
                
                # Use new NotificationService - defaulting to first organization for now
                try:
                    org = db.query(models.Organization).first()
                    org_id = org.id if org else 1
                    NotificationService.send_speedtest_alert(db, org_id, result_dict)
                except Exception as e:
                    logger.error(f"Failed to send new-style speedtest alert: {e}")

        except sqlalchemy.exc.SQLAlchemyError:
            logger.exception("Database error during scheduled speedtest")
            db.rollback()
        except Exception:
            logger.exception("Scheduled speedtest failed unexpectedly")
            db.rollback()
        finally:
            db.close()

    def schedule_system_metrics(self):
        """Schedule metric collection every 5 minutes."""
        if not self.scheduler.get_job("system_metrics"):
            self.scheduler.add_job(
                self._run_system_metrics,
                "interval",
                minutes=5,
                id="system_metrics",
                replace_existing=True
            )
            logger.info("System metrics collection scheduled (Every 5 mins).")

    def schedule_health_checks(self):
        """Schedule health checks every 5 minutes."""
        if not self.scheduler.get_job("health_checks"):
            self.scheduler.add_job(
                self._run_health_checks,
                "interval",
                minutes=5,
                id="health_checks",
                replace_existing=True
            )
            logger.info("Health checks scheduled (Every 5 mins).")

    def schedule_backups(self):
        """Schedule automated backups daily."""
        if not self.scheduler.get_job("automated_backup"):
            self.scheduler.add_job(
                self._run_backup,
                "interval",
                days=1,
                id="automated_backup",
                replace_existing=True
            )
            logger.info("Automated backup scheduled (Daily).")

    def schedule_certificate_checks(self):
        """Schedule SSL certificate monitoring every 24 hours."""
        if not self.scheduler.get_job("certificate_checks"):
            self.scheduler.add_job(
                self._run_certificate_checks,
                "interval",
                hours=24,
                id="certificate_checks",
                replace_existing=True
            )
            logger.info("SSL Certificate monitoring scheduled (Every 24 hours).")

    def _run_system_metrics(self):
        db = SessionLocal()
        try:
            system_service.record_system_metrics(db)
        finally:
            db.close()

    def _run_health_checks(self):
        db = SessionLocal()
        try:
            # Bridging sync APScheduler to async health check
            asyncio.run(health_service.run_all_health_checks(db))
        finally:
            db.close()

    def _run_backup(self):
        db = SessionLocal()
        try:
            backup_service_lib.create_backup(db, is_manual=False)
        finally:
            db.close()

    def _run_certificate_checks(self):
        db = SessionLocal()
        try:
            CertificateMonitor.check_all_certificates(db)
        finally:
            db.close()

    def update_scheduler_from_db(self):
        db = SessionLocal()
        try:
            settings = db.query(models.SystemSettings).all()
            settings_map = {s.key: s.value for s in settings}
            
            # Speedtest interval (minutes)
            try:
                st_interval = int(settings_map.get("speedtest_interval", 180))
            except ValueError:
                st_interval = 180
                
            if st_interval > 0:
                self.schedule_speedtest(st_interval / 60.0)
            else:
                self.schedule_speedtest(0)
                
            logger.info("Scheduler updated from database settings.")
        finally:
            db.close()


scheduler = SchedulerService()


# --- Restricted security-rule condition evaluator -------------------------
# TrafficLog fields only; no eval()/exec(), unknown variables skip the rule.
_NUMERIC_TRAFFIC_FIELDS = frozenset({"upload_bytes", "download_bytes", "device_id"})
_STRING_TRAFFIC_FIELDS = frozenset({"protocol", "app_category"})
# Rules created in the UI before the evaluator existed used these short names.
_LEGACY_FIELD_ALIASES = {"bytes": "download_bytes", "proto": "protocol"}
_COMPARISON_RE = re.compile(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(>=|<=|==|!=|>|<)\s*(.+?)\s*$")
# shortcut: a quoted value containing " and " (e.g. 'Command and Control') is split; such a
# rule fails validation and is skipped. Upgrade to a quote-aware tokenizer if that is needed.
_COMPARISON_SPLIT_RE = re.compile(r"\s*&&\s*|\s+and\s+", re.IGNORECASE)
_OPERATORS = {
    ">": operator.gt,
    "<": operator.lt,
    ">=": operator.ge,
    "<=": operator.le,
    "==": operator.eq,
    "!=": operator.ne,
}


def _parse_condition(condition: str) -> list[tuple[str, str, str]]:
    """Parse 'var OP value && ...' into (variable, op, value) clauses or raise ValueError."""
    clauses = _COMPARISON_SPLIT_RE.split(condition or "")
    if not clauses or any(not clause.strip() for clause in clauses):
        raise ValueError("empty condition")
    parsed = []
    for clause in clauses:
        match = _COMPARISON_RE.match(clause)
        if not match:
            raise ValueError(f"invalid comparison: {clause!r}")
        variable, op, raw_value = match.groups()
        variable = _LEGACY_FIELD_ALIASES.get(variable, variable)
        if variable not in _NUMERIC_TRAFFIC_FIELDS and variable not in _STRING_TRAFFIC_FIELDS:
            raise ValueError(f"unknown variable: {variable!r}")
        value = raw_value.strip().strip("'\"")
        if variable in _NUMERIC_TRAFFIC_FIELDS:
            try:
                float(value)
            except ValueError as exc:
                raise ValueError(f"non-numeric value for {variable}: {raw_value!r}") from exc
        parsed.append((variable, op, value))
    return parsed


def _matches(parsed: list[tuple[str, str, str]], traffic_log) -> bool:
    """Apply parsed clauses to a TrafficLog row (or None for a safe dry run)."""
    for variable, op, value in parsed:
        if variable in _NUMERIC_TRAFFIC_FIELDS:
            actual = getattr(traffic_log, variable, None)
            if actual is None:
                return False
            actual_value, expected = float(actual), float(value)
        else:
            raw = getattr(traffic_log, variable, None)
            actual_value, expected = ("" if raw is None else str(raw)), value
        if not _OPERATORS[op](actual_value, expected):
            return False
    return True


def _evaluate_condition(condition: str, traffic_log) -> bool:
    """Safely evaluate a rule condition against one traffic row."""
    return _matches(_parse_condition(condition), traffic_log)


def _default_organization_id(db: Session) -> int:
    org = db.query(models.Organization).first()
    return org.id if org else 1


def _has_recent_alert(
    db: Session,
    title: str,
    *,
    device_id: int | None,
    organization_id: int | None,
    within: timedelta,
) -> bool:
    query = db.query(models.SecurityAlert).filter(
        models.SecurityAlert.title == title,
        models.SecurityAlert.timestamp >= datetime.now(timezone.utc) - within,
    )
    if device_id is not None:
        query = query.filter(models.SecurityAlert.device_id == device_id)
    if organization_id is not None:
        query = query.filter(models.SecurityAlert.organization_id == organization_id)
    return query.first() is not None


def _broadcast_alert(title: str, description: str, severity: str) -> None:
    # Imported lazily: websockets.py imports the collector at module load.
    try:
        from ..api.routes.websockets import _safe_broadcast

        _safe_broadcast(
            {
                "type": "SECURITY_ALERT",
                "severity": severity,
                "title": title,
                "description": description,
            }
        )
    except Exception as e:
        logger.warning("Failed to broadcast security alert event: %s", e)


def _create_alert(
    db: Session,
    *,
    organization_id: int,
    title: str,
    description: str,
    severity: str,
    device_id: int | None,
) -> None:
    alert = models.SecurityAlert(
        severity=severity,
        title=title,
        description=description,
        device_id=device_id,
        organization_id=organization_id,
    )
    db.add(alert)
    db.commit()
    metrics_manager.increment_alert()
    try:
        NotificationService.send_notification(db, organization_id, "alert", title, description)
    except Exception as e:
        logger.warning("Failed to send alert notification: %s", e)
    _broadcast_alert(title, description, severity)


def evaluate_security_rules():
    """Evaluate active rules over recent traffic and raise deduplicated alerts."""
    db = SessionLocal()
    try:
        rules = db.query(models.SecurityRule).filter(models.SecurityRule.is_active == True).all()  # noqa: E712
        if not rules:
            return

        since = datetime.now(timezone.utc) - timedelta(minutes=5)
        for rule in rules:
            try:
                parsed = _parse_condition(rule.condition)
            except ValueError as e:
                logger.warning("Skipping security rule %s (%s): %s", rule.id, rule.name, e)
                continue

            query = db.query(models.TrafficLog).filter(models.TrafficLog.timestamp >= since)
            if rule.organization_id is not None:
                query = query.join(
                    models.Device, models.TrafficLog.device_id == models.Device.id
                ).filter(models.Device.organization_id == rule.organization_id)
            # shortcut: cap rows per rule to keep the job bounded; widen with pagination if needed.
            rows = query.order_by(models.TrafficLog.timestamp.desc()).limit(5000).all()

            organization_id = rule.organization_id or _default_organization_id(db)
            title = f"Security rule triggered: {rule.name}"

            for row in rows:
                if not _matches(parsed, row):
                    continue
                if _has_recent_alert(
                    db,
                    title,
                    device_id=row.device_id,
                    organization_id=organization_id,
                    within=timedelta(hours=1),
                ):
                    continue
                description = (
                    f"Rule '{rule.name}' matched device {row.device_id}: "
                    f"upload={row.upload_bytes}, download={row.download_bytes}, "
                    f"protocol={row.protocol}, app={row.app_category}."
                )
                _create_alert(
                    db,
                    organization_id=organization_id,
                    title=title,
                    description=description,
                    severity="warning",
                    device_id=row.device_id,
                )
    except sqlalchemy.exc.SQLAlchemyError:
        logger.exception("Database error during security rule evaluation")
        db.rollback()
    except Exception:
        logger.exception("Security rule evaluation failed unexpectedly")
        db.rollback()
    finally:
        db.close()


def detect_and_persist_anomalies():
    """Persist per-organization usage anomalies as alerts (deduped per device/day)."""
    db = SessionLocal()
    try:
        for org in db.query(models.Organization).all():
            try:
                anomalies = ai_predictor.detect_anomalies(organization_id=org.id)
            except Exception as e:
                logger.warning("Anomaly detection failed for organization %s: %s", org.id, e)
                continue

            for anomaly in anomalies:
                mac = anomaly.get("device_mac")
                name = anomaly.get("device_name") or mac or "Unknown device"
                title = f"Traffic anomaly: {name}"
                z_score = anomaly.get("z_score", 0)
                try:
                    z_text = f"{float(z_score):.2f}"
                except (TypeError, ValueError):
                    z_text = str(z_score)
                description = (
                    f"Device {name} ({mac}) used {anomaly.get('current_usage')} bytes vs an "
                    f"average of {anomaly.get('avg_usage')} bytes (z-score {z_text})."
                )
                device_id = None
                if mac:
                    device = db.query(models.Device).filter(
                        models.Device.mac_address == mac,
                        models.Device.organization_id == org.id,
                    ).first()
                    device_id = device.id if device else None
                if _has_recent_alert(
                    db,
                    title,
                    device_id=device_id,
                    organization_id=org.id,
                    within=timedelta(hours=24),
                ):
                    continue
                raw_severity = str(anomaly.get("severity") or "").upper()
                severity = "critical" if raw_severity in ("HIGH", "CRITICAL") else "warning"
                _create_alert(
                    db,
                    organization_id=org.id,
                    title=title,
                    description=description,
                    severity=severity,
                    device_id=device_id,
                )
    except sqlalchemy.exc.SQLAlchemyError:
        logger.exception("Database error during anomaly persistence")
        db.rollback()
    except Exception:
        logger.exception("Anomaly persistence failed unexpectedly")
        db.rollback()
    finally:
        db.close()


def run_health_watchdog():
    """Alert (deduplicated) when real capture or the scheduler is unhealthy."""
    # Synthetic mode is an intentional dev fallback, not a production failure.
    if global_collector.is_synthetic:
        return
    capture_failed = global_collector.is_capture_failed()
    scheduler_running = bool(getattr(scheduler.scheduler, "running", False))
    if not capture_failed and scheduler_running:
        return

    problems = []
    if capture_failed:
        problems.append("packet capture is failing")
    if not scheduler_running:
        problems.append("background scheduler is not running")
    title = "StatSea health watchdog"
    description = "Watchdog detected: " + "; ".join(problems) + "."

    db = SessionLocal()
    try:
        if _has_recent_alert(
            db, title, device_id=None, organization_id=None, within=timedelta(hours=2)
        ):
            return
        _create_alert(
            db,
            organization_id=_default_organization_id(db),
            title=title,
            description=description,
            severity="critical",
            device_id=None,
        )
    finally:
        db.close()


def start_alert_evaluation():
    """Register the 5-minute security rule evaluation job (idempotent)."""
    if not scheduler.scheduler.get_job("alert_evaluation"):
        scheduler.scheduler.add_job(
            evaluate_security_rules,
            "interval",
            minutes=5,
            id="alert_evaluation",
            replace_existing=True,
        )
        logger.info("Security rule evaluation scheduled (Every 5 mins).")


def start_anomaly_detection():
    """Register the hourly anomaly-to-alert job (idempotent)."""
    if not scheduler.scheduler.get_job("anomaly_detection"):
        scheduler.scheduler.add_job(
            detect_and_persist_anomalies,
            "interval",
            hours=1,
            id="anomaly_detection",
            replace_existing=True,
        )
        logger.info("Anomaly detection scheduled (Every 1 hour).")


def start_health_watchdog():
    """Register the 5-minute health watchdog job (idempotent)."""
    if not scheduler.scheduler.get_job("health_watchdog"):
        scheduler.scheduler.add_job(
            run_health_watchdog,
            "interval",
            minutes=5,
            id="health_watchdog",
            replace_existing=True,
        )
        logger.info("Health watchdog scheduled (Every 5 mins).")
