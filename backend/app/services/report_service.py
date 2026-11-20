import io
from datetime import datetime, timedelta

import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db.database import SessionLocal
from app.models import models
from app.services.notification_service import NotificationService

logger = get_logger("ReportService")

VALID_FREQUENCIES = ("daily", "weekly", "monthly")


class ReportService:
    def export_to_csv(self, db: Session, resource: str, organization_id: int | None = None):
        """Exports a database resource to CSV format (optionally scoped to one organization)."""
        query = self._get_query_for_resource(db, resource, organization_id)
        if query is None:
            return None

        df = pd.read_sql(query.statement, query.session.bind)

        # Convert buffer to bytes
        output = io.StringIO()
        df.to_csv(output, index=False)
        return output.getvalue().encode('utf-8')

    def export_to_json(self, db: Session, resource: str, organization_id: int | None = None):
        """Exports a database resource to JSON format (optionally scoped to one organization)."""
        query = self._get_query_for_resource(db, resource, organization_id)
        if query is None:
            return None

        df = pd.read_sql(query.statement, query.session.bind)
        return df.to_json(orient="records").encode('utf-8')

    def generate_pdf_report(
        self, db: Session, report_type: str = "weekly", organization_id: int | None = None
    ):
        """Generates a summary PDF report (optionally scoped to one organization)."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        elements = []

        # Title
        title_style = styles['Heading1']
        elements.append(Paragraph(f"StatSea {report_type.capitalize()} Network Report", title_style))
        elements.append(Paragraph(f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles['Normal']))
        elements.append(Spacer(1, 20))

        # 1. Bandwidth Usage Summary
        elements.append(Paragraph("1. Bandwidth Usage", styles['Heading2']))
        bandwidth_data = self._get_bandwidth_summary(db, report_type, organization_id)
        if not bandwidth_data.empty:
            table_data = [["Date", "Upload (MB)", "Download (MB)"]]
            for _, row in bandwidth_data.iterrows():
                table_data.append([
                    row['date'].strftime('%Y-%m-%d'),
                    f"{row['upload_bytes'] / (1024*1024):.2f}",
                    f"{row['download_bytes'] / (1024*1024):.2f}"
                ])

            t = Table(table_data)
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            elements.append(t)
        else:
            elements.append(Paragraph("No bandwidth data available for this period.", styles['Normal']))

        elements.append(Spacer(1, 20))

        # 2. Top DNS Domains
        elements.append(Paragraph("2. Top DNS Domains", styles['Heading2']))
        dns_data = self._get_top_dns_domains(db, report_type, organization_id=organization_id)
        if not dns_data.empty:
            table_data = [["Domain", "Queries"]]
            for _, row in dns_data.iterrows():
                table_data.append([row['query_domain'], row['count']])

            t = Table(table_data)
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            elements.append(t)
        else:
            elements.append(Paragraph("No DNS data available.", styles['Normal']))

        elements.append(Spacer(1, 20))

        # 3. Security Summary
        elements.append(Paragraph("3. Security Alerts", styles['Heading2']))
        alerts = self._get_recent_alerts(db, report_type, organization_id)
        if alerts:
            for alert in alerts:
                elements.append(Paragraph(f"• [{alert.severity.upper()}] {alert.title}: {alert.description}", styles['Normal']))
        else:
            elements.append(Paragraph("No security alerts generated during this period.", styles['Normal']))

        # Finalize PDF
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()

    def _get_query_for_resource(self, db: Session, resource: str, organization_id: int | None = None):
        if resource == "devices":
            query = db.query(models.Device)
            if organization_id is not None:
                query = query.filter(models.Device.organization_id == organization_id)
            return query
        elif resource == "dns_logs":
            query = db.query(models.DnsLog)
            if organization_id is not None:
                query = query.filter(models.DnsLog.organization_id == organization_id)
            return query
        elif resource == "traffic_logs":
            query = db.query(models.TrafficLog)
            if organization_id is not None:
                # TrafficLog has no org column; scope it through its device.
                query = query.join(
                    models.Device, models.TrafficLog.device_id == models.Device.id
                ).filter(models.Device.organization_id == organization_id)
            return query
        elif resource == "speedtests":
            query = db.query(models.SpeedtestResult)
            if organization_id is not None:
                query = query.filter(models.SpeedtestResult.organization_id == organization_id)
            return query
        elif resource == "alerts":
            query = db.query(models.SecurityAlert)
            if organization_id is not None:
                query = query.filter(models.SecurityAlert.organization_id == organization_id)
            return query
        return None

    def _get_bandwidth_summary(self, db: Session, report_type: str, organization_id: int | None = None):
        days = 7 if report_type == "weekly" else 30
        start_date = datetime.now() - timedelta(days=days)

        if organization_id is not None:
            # SystemDailySummary is global; aggregate per-device summaries via Device for org scoping.
            query = db.query(
                models.DeviceDailySummary.date,
                func.sum(models.DeviceDailySummary.upload_bytes).label('upload_bytes'),
                func.sum(models.DeviceDailySummary.download_bytes).label('download_bytes'),
            ).join(models.Device, models.DeviceDailySummary.device_id == models.Device.id) \
             .filter(models.Device.organization_id == organization_id) \
             .filter(models.DeviceDailySummary.date >= start_date.date()) \
             .group_by(models.DeviceDailySummary.date)
        else:
            query = db.query(
                models.SystemDailySummary.date,
                models.SystemDailySummary.bytes_sent.label('upload_bytes'),
                models.SystemDailySummary.bytes_recv.label('download_bytes')
            ).filter(models.SystemDailySummary.date >= start_date.date())

        return pd.read_sql(query.statement, db.bind)

    def _get_top_dns_domains(
        self, db: Session, report_type: str, limit: int = 10, organization_id: int | None = None
    ):
        days = 7 if report_type == "weekly" else 30
        start_date = datetime.now() - timedelta(days=days)

        query = db.query(
            models.DnsLog.query_domain,
            func.count(models.DnsLog.id).label('count')
        ).filter(models.DnsLog.timestamp >= start_date)
        if organization_id is not None:
            query = query.filter(models.DnsLog.organization_id == organization_id)
        query = query.group_by(models.DnsLog.query_domain) \
                    .order_by(func.count(models.DnsLog.id).desc()) \
                    .limit(limit)

        return pd.read_sql(query.statement, db.bind)

    def _get_recent_alerts(self, db: Session, report_type: str, organization_id: int | None = None):
        days = 7 if report_type == "weekly" else 30
        start_date = datetime.now() - timedelta(days=days)
        query = db.query(models.SecurityAlert).filter(models.SecurityAlert.timestamp >= start_date)
        if organization_id is not None:
            query = query.filter(models.SecurityAlert.organization_id == organization_id)
        return query.order_by(models.SecurityAlert.timestamp.desc()).all()


report_service = ReportService()


def _upsert_setting(db: Session, key: str, value: str, type_: str = "string", description: str | None = None):
    setting = db.query(models.SystemSettings).filter(models.SystemSettings.key == key).first()
    if setting:
        setting.value = value
        setting.type = type_
    else:
        db.add(models.SystemSettings(key=key, value=value, type=type_, description=description))
    return setting


def get_report_settings(db: Session) -> dict:
    """Read the scheduled-report settings, seeding defaults on first read."""
    defaults = {
        "reports_email_enabled": ("false", "bool", "Enable scheduled email reports"),
        "reports_frequency": ("weekly", "string", "Scheduled report frequency (daily|weekly|monthly)"),
    }
    values = {}
    for key, (value, type_, description) in defaults.items():
        setting = db.query(models.SystemSettings).filter(models.SystemSettings.key == key).first()
        if setting is None:
            db.add(models.SystemSettings(key=key, value=value, type=type_, description=description))
            values[key] = value
        else:
            values[key] = setting.value
    db.commit()
    return {
        "reports_email_enabled": str(values["reports_email_enabled"]).lower() == "true",
        "reports_frequency": values["reports_frequency"],
    }


def update_report_settings(
    db: Session, *, email_enabled: bool | None = None, frequency: str | None = None
) -> dict:
    """Upsert the scheduled-report settings and return their current values."""
    if frequency is not None and frequency not in VALID_FREQUENCIES:
        raise ValueError("frequency must be one of daily, weekly, monthly")
    if email_enabled is not None:
        _upsert_setting(db, "reports_email_enabled", "true" if email_enabled else "false", "bool")
    if frequency is not None:
        _upsert_setting(db, "reports_frequency", frequency, "string")
    db.commit()
    return get_report_settings(db)


def send_scheduled_reports():
    """Email summary reports to each organization when enabled, deduped by frequency."""
    db: Session = SessionLocal()
    try:
        settings = {s.key: s.value for s in db.query(models.SystemSettings).all()}
        if str(settings.get("reports_email_enabled", "false")).lower() != "true":
            return

        frequency = settings.get("reports_frequency", "weekly")
        if frequency not in VALID_FREQUENCIES:
            frequency = "weekly"
        interval_days = {"daily": 1, "weekly": 7, "monthly": 30}[frequency]

        last_sent = settings.get("reports_last_sent")
        if last_sent:
            try:
                if (datetime.now() - datetime.fromisoformat(last_sent)).days < interval_days:
                    return
            except ValueError:
                pass  # malformed timestamp: treat as never sent

        report_type = "monthly" if frequency == "monthly" else "weekly"
        for org in db.query(models.Organization).all():
            try:
                pdf = report_service.generate_pdf_report(db, report_type, org.id)
                # shortcut: notification channels carry plain text only (no PDF attachment);
                # recipients get a summary + download endpoint instead of the PDF file.
                message = (
                    f"Your StatSea {report_type} report is ready ({len(pdf)} bytes).\n"
                    f"Download it from /api/reports/pdf/{report_type}."
                )
                NotificationService.send_notification(
                    db, org.id, "report",
                    f"StatSea {report_type.capitalize()} Network Report", message,
                )
            except Exception:
                logger.exception("Failed to send scheduled report for organization %s", org.id)

        _upsert_setting(db, "reports_last_sent", datetime.now().isoformat(), "string")
        db.commit()
    except Exception:
        logger.exception("Scheduled report job failed")
        db.rollback()
    finally:
        db.close()


def start_scheduled_reports():
    """Register the hourly scheduled-report job (the job itself dedupes by frequency)."""
    from app.core.scheduler import scheduler  # local import avoids a circular import at startup

    if not scheduler.scheduler.get_job("scheduled_reports"):
        scheduler.scheduler.add_job(
            send_scheduled_reports,
            "interval",
            hours=1,
            id="scheduled_reports",
            replace_existing=True,
        )
