FROM mcr.microsoft.com/playwright/python:v1.63.0-noble
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY collector.py map_protocol.py map_collector.py ./
ENV PYTHONUNBUFFERED=1
USER pwuser
CMD ["python", "collector.py"]
