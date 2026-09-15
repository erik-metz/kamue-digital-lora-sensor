FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY config.py fetcher.py storage.py main.py ./

RUN mkdir -p /data

HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
    CMD python main.py --healthcheck

CMD ["python", "main.py"]
