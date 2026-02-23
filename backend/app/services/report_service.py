import io
import pandas as pd
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from app.models import models

class ReportService:
    def export_to_csv(self, db: Session, resource: str):
        """Exports a database resource to CSV format."""
        query = self._get_query_for_resource(db, resource)
        if query is None:
            return None
        
        df = pd.read_sql(query.statement, query.session.bind)
        
        # Convert buffer to bytes
        output = io.StringIO()
        df.to_csv(output, index=False)
        return output.getvalue().encode('utf-8')

    def export_to_json(self, db: Session, resource: str):
        """Exports a database resource to JSON format."""
        query = self._get_query_for_resource(db, resource)
        if query is None:
            return None
        
        df = pd.read_sql(query.statement, query.session.bind)
        return df.to_json(orient="records").encode('utf-8')

    def generate_pdf_report(self, db: Session, report_type: str = "weekly"):
        """Generates a summary PDF report."""
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
        bandwidth_data = self._get_bandwidth_summary(db, report_type)
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
        dns_data = self._get_top_dns_domains(db, report_type)
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
        alerts = self._get_recent_alerts(db, report_type)
        if alerts:
            for alert in alerts:
                elements.append(Paragraph(f"• [{alert.severity.upper()}] {alert.title}: {alert.description}", styles['Normal']))
        else:
            elements.append(Paragraph("No security alerts generated during this period.", styles['Normal']))

        # Finalize PDF
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()

    def _get_query_for_resource(self, db: Session, resource: str):
        if resource == "devices":
            return db.query(models.Device)
        elif resource == "dns_logs":
            return db.query(models.DnsLog)
        elif resource == "traffic_logs":
            return db.query(models.TrafficLog)
        elif resource == "speedtests":
            return db.query(models.SpeedtestResult)
        elif resource == "alerts":
            return db.query(models.SecurityAlert)
        return None

    def _get_bandwidth_summary(self, db: Session, report_type: str):
        days = 7 if report_type == "weekly" else 30
        start_date = datetime.now() - timedelta(days=days)
        
        # Aggregate daily summaries
        query = db.query(
            models.SystemDailySummary.date,
            models.SystemDailySummary.bytes_sent.label('upload_bytes'),
            models.SystemDailySummary.bytes_recv.label('download_bytes')
        ).filter(models.SystemDailySummary.date >= start_date.date())
        
        return pd.read_sql(query.statement, db.bind)

    def _get_top_dns_domains(self, db: Session, report_type: str, limit=10):
        days = 7 if report_type == "weekly" else 30
        start_date = datetime.now() - timedelta(days=days)
        
        query = db.query(
            models.DnsLog.query_domain,
            func.count(models.DnsLog.id).label('count')
        ).filter(models.DnsLog.timestamp >= start_date)\
         .group_by(models.DnsLog.query_domain)\
         .order_by(func.count(models.DnsLog.id).desc())\
         .limit(limit)
        
        return pd.read_sql(query.statement, db.bind)

    def _get_recent_alerts(self, db: Session, report_type: str):
        days = 7 if report_type == "weekly" else 30
        start_date = datetime.now() - timedelta(days=days)
        return db.query(models.SecurityAlert)\
                 .filter(models.SecurityAlert.timestamp >= start_date)\
                 .order_by(models.SecurityAlert.timestamp.desc())\
                 .all()

report_service = ReportService()
