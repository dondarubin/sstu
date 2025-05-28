FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml pyproject.toml
RUN pip install --no-cache-dir .

COPY . .

EXPOSE 9090

CMD ["python", "app.py"]