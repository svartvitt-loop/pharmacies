# Playwright's image has the browsers' system libraries; the tests use Google Chrome (channel "chrome").
# Keep the tag in step with @playwright/test in web/package-lock.json.
FROM mcr.microsoft.com/playwright:v1.64.1-noble
RUN npx -y playwright@1.64.1 install --with-deps chrome && rm -rf /root/.npm

# Same setup as web.Dockerfile: runs as the host user and shares the web_node_modules volume.
WORKDIR /app/web
RUN mkdir node_modules && chmod 777 node_modules
ENV HOME=/tmp \
    npm_config_update_notifier=false
