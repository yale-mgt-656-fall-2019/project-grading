FROM alpine:20190925

# Installs latest Chromium (77) package.
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      freetype-dev \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      nodejs 

# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

# Puppeteer v1.19.0 works with Chromium 77.
RUN npm add puppeteer@1.19.0

ENV WORKDIR /app

# Add user so we don't need --no-sandbox with chromium
RUN addgroup -S pptruser && adduser -S -g pptruser pptruser \
    && mkdir -p /home/pptruser/Downloads ${WORKDIR} \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser ${WORKDIR}

WORKDIR ${WORKDIR}
ADD package.json ${WORKDIR}
ADD package-lock.json ${WORKDIR}



# Run everything after as non-privileged user.
USER pptruser