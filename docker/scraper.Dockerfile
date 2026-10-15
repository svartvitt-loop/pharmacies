FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.12.21 /uv /usr/local/bin/uv

# The environment lives in the scraper_venv volume, seeded from /opt/venv; `uv run --locked` syncs it
# from uv.lock before each command, so dependency changes need no image rebuild. World-writable so
# the container can run as the host user (compose `user:`), whose HOME and uv cache are in /tmp.
# The source is mounted at /app/scraper at run time.
RUN mkdir /opt/venv && chmod 777 /opt/venv
ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_CACHE_DIR=/tmp/uv-cache \
    UV_LINK_MODE=copy \
    UV_PYTHON_PREFERENCE=only-system \
    HOME=/tmp \
    PATH=/opt/venv/bin:$PATH
WORKDIR /app/scraper
