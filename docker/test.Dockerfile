# Playwright's image has the browsers' system libraries; the tests use Google Chrome (channel "chrome").
# Keep the tag in step with @playwright/test in web/package-lock.json.
FROM mcr.microsoft.com/playwright:v1.64.1-noble
RUN npx -y playwright@1.64.1 install --with-deps chrome && rm -rf /root/.npm

# Same setup as web.Dockerfile: runs as the host user on the bind-mounted web/ and its node_modules.
WORKDIR /app/web
ENV HOME=/tmp \
    npm_config_update_notifier=false
