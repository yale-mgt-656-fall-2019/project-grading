FROM alpine:20190925

# See this complaint about package version pinning in Alpine.
# TLDR: old packages are dropped from apk repo.
# https://medium.com/@stschindler/the-problem-with-docker-and-alpines-package-pinning-18346593e891
RUN apk add --no-cache \
    # Installs latest Chromium (77) package.
    # Puppeteer v1.19.0 works with Chromium 77.
    "chromium<78" \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    nodejs \
    nodejs-npm

# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
ENV WORKDIR /app/

# Add user so we don't need --no-sandbox with chromium
RUN addgroup -S pptruser && adduser -S -g pptruser pptruser \
    && mkdir -p /home/pptruser/Downloads ${WORKDIR} \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser ${WORKDIR}

# Run everything after as non-privileged user.
USER pptruser

WORKDIR ${WORKDIR}
ADD package.json package-lock.json ${WORKDIR}
RUN npm -g install
COPY index.js config.yaml config.js ${WORKDIR}

