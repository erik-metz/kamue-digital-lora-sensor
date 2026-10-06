FROM python:3.12-slim
WORKDIR /app
COPY satellite-collector/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY satellite-collector/collector.py api/v1/satellite_orbits.py ./
ENV PYTHONUNBUFFERED=1
USER 65534:65534
CMD ["python", "collector.py"]
