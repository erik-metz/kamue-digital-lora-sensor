import os
from typing import Annotated

from fastapi import HTTPException, Request, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

import psycopg_pool

security = HTTPBearer()
API_KEY = os.getenv("API_KEY", "default-fallback-secret-key")

def verify_api_key(
    credentials: Annotated[HTTPAuthorizationCredentials, Security(security)]
):
    if credentials.credentials != API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API Key",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials

async def get_db_pool(request: Request) -> psycopg_pool.AsyncConnectionPool:
    return request.app.state.pool