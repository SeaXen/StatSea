import ssl
import socket
import datetime
from cryptography import x509
from cryptography.hazmat.backends import default_backend
from sqlalchemy.orm import Session
from app.models import models
from app.services.notification_service import NotificationService
from app.core.logging import get_logger

logger = get_logger(__name__)

class CertificateMonitor:
    @staticmethod
    def get_certificate_details(domain: str, port: int = 443, timeout: int = 5):
        """Fetches SSL certificate details for a domain without validating trust chain."""
        try:
            cert_pem = ssl.get_server_certificate((domain, port), timeout=timeout)
            cert = x509.load_pem_x509_certificate(cert_pem.encode('utf-8'), default_backend())
            
            # handle deprecated not_valid_after in newer cryptography versions
            if hasattr(cert, 'not_valid_after_utc'):
                not_after = cert.not_valid_after_utc
            else:
                not_after = cert.not_valid_after.replace(tzinfo=datetime.timezone.utc)
            
            issuer_name = "Unknown Issuer"
            for attr in cert.issuer:
                if attr.oid == x509.NameOID.ORGANIZATION_NAME:
                    issuer_name = attr.value
                    break
            if issuer_name == "Unknown Issuer":
                for attr in cert.issuer:
                    if attr.oid == x509.NameOID.COMMON_NAME:
                        issuer_name = attr.value
                        break
            
            return {
                "expiration_date": not_after,
                "issuer": issuer_name,
            }
        except ssl.SSLError as e:
            return {"error": f"SSL Error: {str(e)}"}
        except socket.gaierror as e:
            return {"error": f"DNS Resolution Failed: {str(e)}"}
        except socket.timeout:
            return {"error": "Connection Timed Out"}
        except Exception as e:
            return {"error": str(e)}

    @staticmethod
    def check_all_certificates(db: Session):
        """Checks all active monitored certificates and updates their status."""
        logger.info("Starting scheduled certificate check")
        certs = db.query(models.MonitoredCertificate).filter(
            models.MonitoredCertificate.is_active == True
        ).all()

        now = datetime.datetime.now(datetime.timezone.utc)
        
        for cert in certs:
            logger.info(f"Checking certificate for {cert.domain}:{cert.port}")
            details = CertificateMonitor.get_certificate_details(cert.domain, cert.port)
            cert.last_checked = now
            
            if "error" in details:
                was_error = cert.error_message is not None
                cert.error_message = details["error"]
                logger.error(f"Failed to check certificate for {cert.domain}: {details['error']}")
                if not was_error:
                    NotificationService.send_alert(
                        "Certificate Check Failed",
                        f"StatSea failed to check the SSL certificate for {cert.domain}:{cert.port}. Error: {details['error']}",
                        cert.organization_id,
                        db
                    )
            else:
                cert.expiration_date = details["expiration_date"]
                cert.issuer = details.get("issuer", "Unknown")
                
                if cert.error_message:
                    logger.info(f"Certificate check recovered for {cert.domain}")
                    cert.error_message = None
                    
                delta = cert.expiration_date - now
                cert.days_until_expiration = delta.days
                
                # Alert at specific thresholds to avoid spamming
                if cert.days_until_expiration in [14, 7, 3, 1, 0, -1]:
                    severity = "Critical" if cert.days_until_expiration <= 0 else "Warning"
                    logger.warning(f"Certificate for {cert.domain} expires in {cert.days_until_expiration} days.")
                    NotificationService.send_alert(
                        f"SSL Certificate Expiry {severity}",
                        f"The SSL certificate for {cert.domain} expires in {cert.days_until_expiration} days (on {cert.expiration_date.strftime('%Y-%m-%d')}). Issuer: {cert.issuer}.",
                        cert.organization_id,
                        db
                    )
                    
        db.commit()
        logger.info("Completed scheduled certificate check")
