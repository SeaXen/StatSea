import gzip
import os
import shutil
import tempfile
from datetime import datetime

from sqlalchemy.orm import Session

from ..core.logging import get_logger
from ..models import models

logger = get_logger("BackupService")

BACKUP_DIR = "./data/backups"
DB_FILE = "./data/statsea_saas.db"

def create_backup(db: Session, is_manual: bool = False):
    """Create a compressed backup of the SQLite database."""
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)
        
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"statsea_backup_{timestamp}.db.gz"
    filepath = os.path.join(BACKUP_DIR, filename)
    
    # Step 1: Copy to a temporary file to minimize lock time
    temp_file = filepath + ".tmp"
    shutil.copy2(DB_FILE, temp_file)
    
    # Step 2: Compress the temporary file
    try:
        with open(temp_file, 'rb') as f_in:
            with gzip.open(filepath, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)
            
    # Step 3: Record in database
    file_size = os.path.getsize(filepath)
    record = models.BackupRecord(
        filename=filename,
        file_path=os.path.abspath(filepath),
        size_bytes=file_size,
        is_manual=is_manual
    )
    db.add(record)
    db.commit()
    
    # Step 4: Cleanup old backups (keep last 7)
    cleanup_old_backups(db)
    
    return record

def cleanup_old_backups(db: Session, keep_count: int = 7):
    """Remove old backup files and records."""
    records = db.query(models.BackupRecord).order_by(models.BackupRecord.created_at.desc()).all()
    
    if len(records) > keep_count:
        to_delete = records[keep_count:]
        for record in to_delete:
            try:
                if os.path.exists(record.file_path):
                    os.remove(record.file_path)
            except OSError as err:
                logger.warning("Could not remove old backup file %s: %s", record.file_path, err)
            db.delete(record)
        db.commit()

def list_backups(db: Session):
    return db.query(models.BackupRecord).order_by(models.BackupRecord.created_at.desc()).all()

def delete_backup(db: Session, backup_id: int):
    record = db.query(models.BackupRecord).filter(models.BackupRecord.id == backup_id).first()
    if record:
        if os.path.exists(record.file_path):
            os.remove(record.file_path)
        db.delete(record)
        db.commit()
        return True
    return False


def restore_backup(db: Session, backup_id: int):
    """Restore a SQLite backup atomically, returning its BackupRecord."""
    record = db.query(models.BackupRecord).filter(models.BackupRecord.id == backup_id).first()
    if not record:
        raise ValueError("Backup not found")

    # Confine the source to the backup directory (path traversal protection).
    backup_root = os.path.realpath(BACKUP_DIR)
    source = os.path.realpath(record.file_path)
    if os.path.commonpath([backup_root, source]) != backup_root:
        raise ValueError("Invalid backup path")
    if not os.path.isfile(source):
        raise FileNotFoundError("Backup file not found on disk")
    if record.size_bytes is not None and os.path.getsize(source) != record.size_bytes:
        raise ValueError("Backup size mismatch")

    # Commit and reload column values before swapping the file, so the returned record
    # serializes from memory rather than re-querying the replaced database.
    db.commit()
    db.refresh(record)

    db_dir = os.path.dirname(os.path.abspath(DB_FILE)) or "."
    fd, temp_path = tempfile.mkstemp(prefix="statsea_restore_", suffix=".db", dir=db_dir)
    os.close(fd)
    try:
        with gzip.open(source, "rb") as f_in, open(temp_path, "wb") as f_out:
            shutil.copyfileobj(f_in, f_out)
        for sidecar in (DB_FILE + "-wal", DB_FILE + "-shm"):
            if os.path.exists(sidecar):
                os.remove(sidecar)
        os.replace(temp_path, DB_FILE)
    except Exception:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise

    # shortcut: no integrity check or vacuum is run on the restored DB; verify out of band.
    logger.info("Restored database from backup %s", record.filename)
    return record
