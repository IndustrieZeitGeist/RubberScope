FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 RUBBERSCOPE_HOSTED=1 OPENBLAS_NUM_THREADS=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN useradd --create-home web
COPY app/ app/
USER web
CMD ["sh", "-c", "exec python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --limit-concurrency 8"]

