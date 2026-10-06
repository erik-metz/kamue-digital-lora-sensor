FROM python:3.11-slim

WORKDIR /app

# Rasterio's Linux wheel requires Expat, which python:slim does not include.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libexpat1 \
    && rm -rf /var/lib/apt/lists/*

# Ensure /app is in the Python path
ENV PYTHONPATH=/app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN python -c "import rasterio; import numpy; from PIL import Image"

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
