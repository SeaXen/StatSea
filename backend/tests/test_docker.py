import pytest
from unittest.mock import MagicMock, patch

@pytest.mark.asyncio
async def test_list_containers(auth_client):
    with patch("app.services.docker_monitor.docker.from_env") as mock_docker:
        mock_client = MagicMock()
        mock_docker.return_value = mock_client
        mock_client.containers.list.return_value = [
            MagicMock(id="123", name="test_container", status="running", image=MagicMock(tags=["test:latest"]))
        ]
        
        response = await auth_client.get("/api/v1/docker/containers")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert data[0]["name"] == "test_container"

@pytest.mark.asyncio
async def test_container_stats(auth_client):
    with patch("app.services.docker_monitor.docker.from_env") as mock_docker:
        mock_client = MagicMock()
        mock_docker.return_value = mock_client
        mock_container = MagicMock()
        mock_client.containers.get.return_value = mock_container
        mock_container.stats.return_value = [{"cpu_stats": {}, "memory_stats": {}}]
        
        response = await auth_client.get("/api/v1/docker/containers/123/stats")
        assert response.status_code == 200
