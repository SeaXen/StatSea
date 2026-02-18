import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, date
from sqlalchemy import func
from app.core.quotas import check_quotas
from app.models import models

def test_check_quotas_daily_limit_exceeded(mocker):
    # Mock DB session
    mock_db = MagicMock()
    
    # Mock Quota
    mock_device = MagicMock()
    mock_device.id = 1
    mock_device.mac_address = "00:11:22:33:44:55"
    
    mock_quota = MagicMock()
    mock_quota.device = mock_device
    mock_quota.daily_limit_bytes = 1000 # 1KB limit
    mock_quota.monthly_limit_bytes = 0
    
    mock_db.query.return_value.all.return_value = [mock_quota]
    
    # Mock daily usage query
    # calculate usage: sum(upload + download)
    # mock_db.query(...).filter(...).scalar() returns usage
    mock_db.query.return_value.filter.return_value.scalar.return_value = 1500 # 1.5KB used
    
    # Mock _trigger_alert to verify it's called
    with patch("app.core.quotas._trigger_alert") as mock_trigger:
        check_quotas(mock_db)
        
        # Verify usage check
        assert mock_trigger.called
        args, _ = mock_trigger.call_args
        assert args[1] == mock_device # device
        assert args[2] == "Daily" # type
        assert args[3] == 1500 # current usage
        assert args[4] == 1000 # limit

def test_check_quotas_under_limit(mocker):
    mock_db = MagicMock()
    mock_quota = MagicMock()
    mock_quota.daily_limit_bytes = 1000
    mock_quota.monthly_limit_bytes = 0
    mock_quota.device.id = 1
    
    mock_db.query.return_value.all.return_value = [mock_quota]
    mock_db.query.return_value.filter.return_value.scalar.return_value = 500 # Under limit
    
    with patch("app.core.quotas._trigger_alert") as mock_trigger:
        check_quotas(mock_db)
        assert not mock_trigger.called
