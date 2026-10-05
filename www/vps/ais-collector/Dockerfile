FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY collector.py .
ENV PYTHONUNBUFFERED=1
USER 65534:65534
CMD ["python", "collector.py"]
