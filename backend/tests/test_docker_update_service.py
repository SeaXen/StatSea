import pytest
import httpx
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.docker_update_service import DockerUpdateService
import asyncio

@pytest.fixture
def update_service():
    service = DockerUpdateService()
    return service

@pytest.mark.asyncio
async def test_check_updates_with_docker_hub_mock(update_service):
    # Setup mock container stats
    mock_stats = [
        {
            "id": "container1",
            "name": "nginx-web",
            "image": "nginx:latest",
            "image_id": "sha256:old-digest"
        }
    ]
    
    mock_token_resp = MagicMock()
    mock_token_resp.status_code = 200
    mock_token_resp.json.return_value = {"token": "fake-token"}
    
    mock_head_resp = MagicMock()
    mock_head_resp.status_code = 200
    mock_head_resp.headers = {"Docker-Content-Digest": "sha256:new-digest"}

    async def side_effect_get(*args, **kwargs):
        if "auth.docker.io/token" in args[0]:
            return mock_token_resp
        return MagicMock()

    async def side_effect_head(*args, **kwargs):
        if "manifests/latest" in args[0]:
            return mock_head_resp
        return MagicMock()

    # Mock the httpx AsyncClient context manager
    mock_client = AsyncMock()
    mock_client.get.side_effect = side_effect_get
    mock_client.head.side_effect = side_effect_head

    mock_client_ctx = AsyncMock()
    mock_client_ctx.__aenter__.return_value = mock_client
    
    with patch("app.core.docker_monitor.DockerMonitor.get_stats", return_value=mock_stats):
        with patch("httpx.AsyncClient", return_value=mock_client_ctx):
            await update_service.check_updates()
            
            status = update_service.get_update_status("container1")
            
            assert status["update_available"] is True
            assert status["remote_digest"] == "sha256:new-digest"
