import os
import shutil
import gzip
from datetime import datetime
from sqlalchemy.orm import Session
from ..models import models
from ..core.config import settings

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
            except Exception:
                pass # Already gone or permission error
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
