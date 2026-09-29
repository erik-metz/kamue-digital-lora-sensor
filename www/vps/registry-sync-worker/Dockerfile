FROM python:3.12-slim

WORKDIR /app

# Pyosmium's Linux wheel dynamically links Expat, absent from python:slim.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libexpat1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && python -c "import osmium"

COPY . .

ENV PYTHONUNBUFFERED=1
ENV TZ=Europe/Berlin

CMD ["python", "main.py"]
