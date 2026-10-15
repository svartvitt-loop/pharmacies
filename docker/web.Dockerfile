FROM node:24-slim

# The node_modules volume is seeded from this directory. World-writable so the container can run
# as the host user (compose `user:`) whatever its UID; dependencies are installed by npm-deps.sh.
WORKDIR /app/web
RUN mkdir node_modules && chmod 777 node_modules
ENV HOME=/tmp \
    npm_config_update_notifier=false
