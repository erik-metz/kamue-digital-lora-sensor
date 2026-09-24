"""Registry acquisition and shared movement prediction service."""

import asyncio
import logging

from runner import main

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
