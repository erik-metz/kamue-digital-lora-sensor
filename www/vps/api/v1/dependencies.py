import os
import secrets
from typing import Annotated

from fastapi import HTTPException, Request, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

import psycopg_pool

security = HTTPBearer()

def _get_env_key(var_name: str) -> str:
    """Retrieves an API key from environment, ensuring non-empty stripped value."""
    key = os.getenv(var_name, "").strip()
    return key


def verify_ingestion_key(
    credentials: Annotated[HTTPAuthorizationCredentials, Security(security)]
) -> str:
    """Verifies bearer token for telemetry ingestion (TTN / sensors)."""
    expected_key = _get_env_key("API_KEY")
    if not expected_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ingestion API key is not configured on the server.",
        )

    if not secrets.compare_digest(credentials.credentials, expected_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing Ingestion API Key",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials


def verify_admin_key(
    credentials: Annotated[HTTPAuthorizationCredentials, Security(security)]
) -> str:
    """Verifies bearer token for administrative mutations (Next.js app)."""
    # Allow ADMIN_API_KEY, or fall back to API_KEY if ADMIN_API_KEY is not separately defined
    expected_key = _get_env_key("ADMIN_API_KEY") or _get_env_key("API_KEY")
    if not expected_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Admin API key is not configured on the server.",
        )

    if not secrets.compare_digest(credentials.credentials, expected_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or unauthorized Admin API Key",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials


# Backward-compatible alias for existing imports
verify_api_key = verify_ingestion_key


async def get_db_pool(request: Request) -> psycopg_pool.AsyncConnectionPool:
    return request.app.state.pool