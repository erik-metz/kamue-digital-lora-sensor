FROM python:3.11-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
COPY environment-collector/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY environment-collector/*.py ./
COPY api/v1/weather_measurements.py ./
RUN useradd --system --uid 10001 collector && mkdir /data && chown collector /data
USER collector
HEALTHCHECK --interval=60s --timeout=10s --start-period=180s CMD ["python", "main.py", "--healthcheck"]
CMD ["python", "main.py"]
