import logging
from calendar import monthrange
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.models import models

logger = logging.getLogger(__name__)


class BandwidthAggregationService:
    @staticmethod
    def format_rate(total_bytes: int, seconds: int) -> str:
        """Format average rate as human-readable bit/s string."""
        if seconds <= 0:
            return "0 bit/s"
        bits_per_sec = (total_bytes * 8) / seconds
        if bits_per_sec >= 1_000_000_000:
            return f"{bits_per_sec / 1_000_000_000:.2f} Gbit/s"
        elif bits_per_sec >= 1_000_000:
            return f"{bits_per_sec / 1_000_000:.2f} Mbit/s"
        elif bits_per_sec >= 1_000:
            return f"{bits_per_sec / 1_000:.2f} kbit/s"
        return f"{bits_per_sec:.0f} bit/s"

    @staticmethod
    def calc_rate_bps(total_bytes: int, seconds: int) -> float:
        """Return average rate in bits per second."""
        if seconds <= 0:
            return 0.0
        return (total_bytes * 8) / seconds

    @classmethod
    def get_interfaces(cls, db: Session) -> list[str]:
        interfaces = db.query(models.SystemNetworkHistory.interface).distinct().all()
        return [i[0] for i in interfaces if i[0]]

    @classmethod
    def get_summary(cls, db: Session) -> dict[str, Any]:
        today = date.today()
        yesterday = today - timedelta(days=1)
        current_month = today.strftime("%Y-%m")
        days_in_month = monthrange(today.year, today.month)[1]
        day_of_month = today.day

        interfaces = cls.get_interfaces(db)
        summary: dict[str, Any] = {}

        for interface in interfaces:
            iface_data: dict[str, Any] = {
                "today": {"rx": 0, "tx": 0, "total": 0, "avg_rate": "0 bit/s", "avg_rate_bps": 0},
                "yesterday": {"rx": 0, "tx": 0, "total": 0, "avg_rate": "0 bit/s", "avg_rate_bps": 0},
                "month": {"rx": 0, "tx": 0, "total": 0, "avg_rate": "0 bit/s", "avg_rate_bps": 0},
                "all_time": {"rx": 0, "tx": 0, "total": 0, "avg_rate": "0 bit/s", "avg_rate_bps": 0, "since": None},
                "estimated": {"rx": 0, "tx": 0, "total": 0},
            }

            # Today
            today_stats = (
                db.query(
                    func.sum(models.SystemNetworkHistory.bytes_recv).label("rx"),
                    func.sum(models.SystemNetworkHistory.bytes_sent).label("tx"),
                )
                .filter(
                    models.SystemNetworkHistory.interface == interface,
                    func.date(models.SystemNetworkHistory.timestamp) == today,
                )
                .first()
            )
            if today_stats and today_stats.rx is not None:
                rx, tx = int(today_stats.rx), int(today_stats.tx)
                total = rx + tx
                now = datetime.now()
                elapsed = (now - now.replace(hour=0, minute=0, second=0, microsecond=0)).total_seconds()
                iface_data["today"] = {
                    "rx": rx, "tx": tx, "total": total,
                    "avg_rate": cls.format_rate(total, int(elapsed)),
                    "avg_rate_bps": cls.calc_rate_bps(total, int(elapsed)),
                }

            # Yesterday
            yesterday_stats = (
                db.query(
                    func.sum(models.SystemNetworkHistory.bytes_recv).label("rx"),
                    func.sum(models.SystemNetworkHistory.bytes_sent).label("tx"),
                )
                .filter(
                    models.SystemNetworkHistory.interface == interface,
                    func.date(models.SystemNetworkHistory.timestamp) == yesterday,
                )
                .first()
            )
            if yesterday_stats and yesterday_stats.rx is not None:
                rx, tx = int(yesterday_stats.rx), int(yesterday_stats.tx)
                total = rx + tx
                iface_data["yesterday"] = {
                    "rx": rx, "tx": tx, "total": total,
                    "avg_rate": cls.format_rate(total, 86400),
                    "avg_rate_bps": cls.calc_rate_bps(total, 86400),
                }

            # Month
            month_stats = (
                db.query(
                    models.SystemInterfaceMonthlySummary.bytes_recv,
                    models.SystemInterfaceMonthlySummary.bytes_sent,
                )
                .filter(
                    models.SystemInterfaceMonthlySummary.interface == interface,
                    models.SystemInterfaceMonthlySummary.month == current_month,
                )
                .first()
            )
            if month_stats:
                rx, tx = int(month_stats.bytes_recv), int(month_stats.bytes_sent)
                total = rx + tx
                elapsed_month = day_of_month * 86400
                iface_data["month"] = {
                    "rx": rx, "tx": tx, "total": total,
                    "avg_rate": cls.format_rate(total, elapsed_month),
                    "avg_rate_bps": cls.calc_rate_bps(total, elapsed_month),
                }
                if day_of_month > 0:
                    factor = days_in_month / day_of_month
                    iface_data["estimated"] = {
                        "rx": int(rx * factor),
                        "tx": int(tx * factor),
                        "total": int(total * factor),
                    }

            # All Time
            all_time = (
                db.query(
                    func.sum(models.SystemInterfaceDailySummary.bytes_recv).label("rx"),
                    func.sum(models.SystemInterfaceDailySummary.bytes_sent).label("tx"),
                    func.min(models.SystemInterfaceDailySummary.date).label("since"),
                )
                .filter(models.SystemInterfaceDailySummary.interface == interface)
                .first()
            )
            if all_time and all_time.rx is not None:
                rx, tx = int(all_time.rx), int(all_time.tx)
                total = rx + tx
                since_date = all_time.since
                if since_date:
                    elapsed_all = (today - since_date).days * 86400
                    iface_data["all_time"] = {
                        "rx": rx, "tx": tx, "total": total,
                        "avg_rate": cls.format_rate(total, elapsed_all),
                        "avg_rate_bps": cls.calc_rate_bps(total, elapsed_all),
                        "since": since_date.isoformat(),
                    }

            summary[interface] = iface_data

        return summary

    @classmethod
    def get_fiveminute(cls, db: Session, interface: str, hours: int = 24) -> list[dict[str, Any]]:
        since = datetime.now() - timedelta(hours=hours)
        stats = (
            db.query(
                models.SystemNetworkHistory.timestamp,
                models.SystemNetworkHistory.bytes_recv,
                models.SystemNetworkHistory.bytes_sent,
            )
            .filter(
                models.SystemNetworkHistory.interface == interface,
                models.SystemNetworkHistory.timestamp >= since,
            )
            .order_by(models.SystemNetworkHistory.timestamp.asc())
            .all()
        )

        buckets: dict[str, dict[str, int]] = {}
        for s in stats:
            ts = s.timestamp
            bucket_min = (ts.minute // 5) * 5
            bucket_ts = ts.replace(minute=bucket_min, second=0, microsecond=0)
            key = bucket_ts.isoformat()
            if key not in buckets:
                buckets[key] = {"rx": 0, "tx": 0}
            buckets[key]["rx"] += int(s.bytes_recv)
            buckets[key]["tx"] += int(s.bytes_sent)

        result = []
        for ts_key in sorted(buckets.keys()):
            b = buckets[ts_key]
            result.append({
                "timestamp": ts_key,
                "rx": b["rx"],
                "tx": b["tx"],
                "total": b["rx"] + b["tx"],
            })
        return result

    @classmethod
    def get_hourly(cls, db: Session, interface: str, target_date: date) -> list[dict[str, Any]]:
        stats = (
            db.query(
                func.strftime("%H", models.SystemNetworkHistory.timestamp).label("hour"),
                func.sum(models.SystemNetworkHistory.bytes_recv).label("rx"),
                func.sum(models.SystemNetworkHistory.bytes_sent).label("tx"),
            )
            .filter(
                models.SystemNetworkHistory.interface == interface,
                func.date(models.SystemNetworkHistory.timestamp) == target_date,
            )
            .group_by(func.strftime("%H", models.SystemNetworkHistory.timestamp))
            .order_by("hour")
            .all()
        )

        results = {f"{i:02d}": {"rx": 0, "tx": 0, "total": 0} for i in range(24)}
        for stat in stats:
            if stat.hour in results:
                rx, tx = int(stat.rx), int(stat.tx)
                results[stat.hour] = {"rx": rx, "tx": tx, "total": rx + tx}

        return [{"hour": k, **v} for k, v in sorted(results.items())]

    @classmethod
    def get_daily(cls, db: Session, interface: str, days: int = 30) -> list[dict[str, Any]]:
        start_date = date.today() - timedelta(days=days - 1)
        stats = (
            db.query(
                models.SystemInterfaceDailySummary.date,
                models.SystemInterfaceDailySummary.bytes_recv,
                models.SystemInterfaceDailySummary.bytes_sent,
            )
            .filter(
                models.SystemInterfaceDailySummary.interface == interface,
                models.SystemInterfaceDailySummary.date >= start_date,
            )
            .order_by(models.SystemInterfaceDailySummary.date.desc())
            .all()
        )

        result = []
        for stat in stats:
            rx, tx = int(stat.bytes_recv), int(stat.bytes_sent)
            total = rx + tx
            result.append({
                "date": stat.date.isoformat(),
                "rx": rx,
                "tx": tx,
                "total": total,
                "avg_rate": cls.format_rate(total, 86400),
                "avg_rate_bps": cls.calc_rate_bps(total, 86400),
            })
        return result

    @classmethod
    def get_monthly(cls, db: Session, interface: str, limit: int = 12) -> list[dict[str, Any]]:
        stats = (
            db.query(
                models.SystemInterfaceMonthlySummary.month,
                models.SystemInterfaceMonthlySummary.bytes_recv,
                models.SystemInterfaceMonthlySummary.bytes_sent,
            )
            .filter(models.SystemInterfaceMonthlySummary.interface == interface)
            .order_by(desc(models.SystemInterfaceMonthlySummary.month))
            .limit(limit)
            .all()
        )

        today = date.today()
        current_month_str = today.strftime("%Y-%m")
        days_in_month = monthrange(today.year, today.month)[1]
        day_of_month = today.day

        result = []
        for stat in stats:
            rx, tx = int(stat.bytes_recv), int(stat.bytes_sent)
            total = rx + tx

            parts = stat.month.split("-")
            year, month = int(parts[0]), int(parts[1])
            total_days_in_month = monthrange(year, month)[1]
            elapsed_seconds = total_days_in_month * 86400

            entry: dict[str, Any] = {
                "month": stat.month,
                "rx": rx,
                "tx": tx,
                "total": total,
                "avg_rate": cls.format_rate(total, elapsed_seconds),
                "avg_rate_bps": cls.calc_rate_bps(total, elapsed_seconds),
            }

            if stat.month == current_month_str and day_of_month > 0:
                factor = days_in_month / day_of_month
                entry["estimated_rx"] = int(rx * factor)
                entry["estimated_tx"] = int(tx * factor)
                entry["estimated_total"] = int(total * factor)

            result.append(entry)
        return result

    @classmethod
    def get_yearly(cls, db: Session, interface: str) -> list[dict[str, Any]]:
        stats = (
            db.query(
                models.SystemInterfaceMonthlySummary.month,
                models.SystemInterfaceMonthlySummary.bytes_recv,
                models.SystemInterfaceMonthlySummary.bytes_sent,
            )
            .filter(models.SystemInterfaceMonthlySummary.interface == interface)
            .all()
        )

        yearly: dict[str, dict[str, int]] = {}
        for stat in stats:
            year = stat.month.split("-")[0]
            if year not in yearly:
                yearly[year] = {"rx": 0, "tx": 0}
            yearly[year]["rx"] += int(stat.bytes_recv)
            yearly[year]["tx"] += int(stat.bytes_sent)

        today = date.today()
        current_year = str(today.year)
        day_of_year = today.timetuple().tm_yday
        is_leap = (today.year % 4 == 0 and today.year % 100 != 0) or (today.year % 400 == 0)
        days_in_year = 366 if is_leap else 365

        result = []
        for year in sorted(yearly.keys(), reverse=True):
            rx, tx = yearly[year]["rx"], yearly[year]["tx"]
            total = rx + tx
            year_days = days_in_year if year == current_year else 365
            elapsed = year_days * 86400

            entry: dict[str, Any] = {
                "year": year,
                "rx": rx,
                "tx": tx,
                "total": total,
                "avg_rate": cls.format_rate(total, elapsed),
                "avg_rate_bps": cls.calc_rate_bps(total, elapsed),
            }

            if year == current_year and day_of_year > 0:
                factor = days_in_year / day_of_year
                entry["estimated_rx"] = int(rx * factor)
                entry["estimated_tx"] = int(tx * factor)
                entry["estimated_total"] = int(total * factor)

            result.append(entry)
        return result

    @classmethod
    def get_top_days(cls, db: Session, interface: str, limit: int = 10) -> list[dict[str, Any]]:
        stats = (
            db.query(
                models.SystemInterfaceDailySummary.date,
                models.SystemInterfaceDailySummary.bytes_recv,
                models.SystemInterfaceDailySummary.bytes_sent,
                (
                    models.SystemInterfaceDailySummary.bytes_recv
                    + models.SystemInterfaceDailySummary.bytes_sent
                ).label("total"),
            )
            .filter(models.SystemInterfaceDailySummary.interface == interface)
            .order_by(desc("total"))
            .limit(limit)
            .all()
        )

        result = []
        for stat in stats:
            rx, tx = int(stat.bytes_recv), int(stat.bytes_sent)
            total = int(stat.total)
            result.append({
                "date": stat.date.isoformat(),
                "rx": rx,
                "tx": tx,
                "total": total,
                "avg_rate": cls.format_rate(total, 86400),
                "avg_rate_bps": cls.calc_rate_bps(total, 86400),
            })
        return result
