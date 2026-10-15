FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.12.21 /uv /usr/local/bin/uv

# The environment lives in the image; the source is mounted at /app/scraper at run time.
ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_LINK_MODE=copy \
    PATH=/opt/venv/bin:$PATH
WORKDIR /app/scraper
COPY scraper/pyproject.toml scraper/uv.lock ./
RUN uv sync --locked && rm -rf /root/.cache
