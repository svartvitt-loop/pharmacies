# Playwright's image has the browsers' system libraries; the tests use Google Chrome (channel "chrome").
# PLAYWRIGHT_VERSION must equal @playwright/test in web/package.json, which is pinned exactly.
ARG PLAYWRIGHT_VERSION=1.64.1
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble
ARG PLAYWRIGHT_VERSION
RUN npx -y playwright@${PLAYWRIGHT_VERSION} install --with-deps chrome && rm -rf /root/.npm

# Same setup as web.Dockerfile: runs as the host user on the bind-mounted web/ and its node_modules.
WORKDIR /app/web
ENV HOME=/tmp \
    npm_config_update_notifier=false
