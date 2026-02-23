import logging
import asyncio
import httpx
from datetime import datetime, timezone
from typing import Dict, Any

from app.core.docker_monitor import docker_monitor

logger = logging.getLogger(__name__)

class DockerUpdateService:
    """
    Checks remote registries for updates to running Docker container images.
    """

    def __init__(self):
        self.updates: Dict[str, Dict[str, Any]] = {}  # container_id -> update info
        self.last_check = None
        self._task = None

    def start(self):
        if self._task is None:
            self._task = asyncio.create_task(self._monitor_loop())

    async def _monitor_loop(self):
        while True:
            try:
                await self.check_updates()
            except Exception as e:
                logger.error(f"Error checking for Docker updates: {e}")
            
            # Check every 12 hours
            await asyncio.sleep(12 * 3600)

    async def check_updates(self):
        """Fetch running containers and check if newer images exist on their remote registry."""
        containers = docker_monitor.get_stats()
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            for container in containers:
                cid = container.get("id")
                image_name = container.get("image")
                
                # If image is unknown or invalid, skip
                if not image_name or image_name == "unknown":
                    continue

                # Basic parsing (assumes Docker Hub if no host specified, and latest if no tag)
                # Note: Full registry parsing can be complex, this is a basic implementation
                # focusing on Docker Hub and GHCR.
                registry = "docker.io"
                repo = image_name
                tag = "latest"
                
                parts = image_name.split("/")
                if len(parts) > 1 and ("." in parts[0] or ":" in parts[0] or parts[0] == "localhost"):
                    registry = parts[0]
                    repo = "/".join(parts[1:])
                else:
                    if len(parts) == 1:
                        repo = f"library/{image_name}"

                if ":" in repo:
                    repo, tag = repo.split(":", 1)
                
                # We can't always perfectly fetch remote digests without auth for all registries.
                # For Phase 12 MVP, we'll hit Docker Hub v2 API to get the digest of the remote tag
                # and compare it with the local digest.
                # We'll need the local image digest to compare accurately, or check if remote has updated
                # since local creation.
                
                has_update = False
                remote_digest = None
                
                try:
                    if registry == "docker.io":
                        # Docker Hub anonymous token
                        token_url = f"https://auth.docker.io/token?service=registry.docker.io&scope=repository:{repo}:pull"
                        token_resp = await client.get(token_url)
                        if token_resp.status_code == 200:
                            token = token_resp.json().get("token")
                            
                            # Get manifest
                            manifest_url = f"https://registry-1.docker.io/v2/{repo}/manifests/{tag}"
                            headers = {
                                "Authorization": f"Bearer {token}",
                                "Accept": "application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json"
                            }
                            menifest_resp = await client.head(manifest_url, headers=headers)
                            if menifest_resp.status_code == 200:
                                remote_digest = menifest_resp.headers.get("Docker-Content-Digest")
                    elif registry == "ghcr.io":
                        # GHCR anonymous token
                        token_url = f"https://ghcr.io/token?scope=repository:{repo}:pull"
                        token_resp = await client.get(token_url)
                        if token_resp.status_code == 200:
                            token = token_resp.json().get("token")
                            
                            manifest_url = f"https://ghcr.io/v2/{repo}/manifests/{tag}"
                            headers = {
                                "Authorization": f"Bearer {token}",
                                "Accept": "application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json"
                            }
                            menifest_resp = await client.head(manifest_url, headers=headers)
                            if menifest_resp.status_code == 200:
                                remote_digest = menifest_resp.headers.get("Docker-Content-Digest")
                except Exception as e:
                    logger.debug(f"Failed to check update for {image_name}: {e}")
                    continue
                
                local_digest = container.get("image_id", "")
                
                # local_digest usually looks like "sha256:12345..."
                # remote_digest usually looks like "sha256:54321..."
                if remote_digest and local_digest and remote_digest != local_digest:
                    # Often local image ID is not exactly the remote registry manifest digest,
                    # depending on multi-arch images. Perfect comparison is tricky without full inspection.
                    # For MVP, we simply flag if we successfully fetched a remote digest and it doesn't match local.
                    # A more robust check might compare 'Created' dates.
                    
                    # For now, mark as update available if we get here and they differ.
                    has_update = True
                
                self.updates[cid] = {
                    "update_available": has_update,
                    "remote_digest": remote_digest,
                    "last_checked": datetime.now(timezone.utc).isoformat()
                }
                
        self.last_check = datetime.now(timezone.utc)

    def get_update_status(self, container_id: str) -> Dict[str, Any]:
        return self.updates.get(container_id, {"update_available": False})


docker_update_service = DockerUpdateService()
