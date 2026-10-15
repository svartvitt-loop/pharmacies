FROM node:24-slim

# Runs as the host user (compose `user:`) on the bind-mounted web/; npm-deps.sh installs the
# dependencies into web/node_modules, where the host's editor sees them too.
WORKDIR /app/web
ENV HOME=/tmp \
    npm_config_update_notifier=false
