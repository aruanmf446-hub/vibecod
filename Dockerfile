# Optional Docker preview; does not change the existing native Render service.
FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json ./
COPY scripts/piper-requirements.txt /tmp/piper-requirements.txt
# Optional public CA bundle for corporate build proxies; never stored in the image.
RUN --mount=type=secret,id=build_ca \
    set -eu; \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca PIP_CERT=/run/secrets/build_ca SSL_CERT_FILE=/run/secrets/build_ca; fi; \
    apt-get update; \
    apt-get install -y --no-install-recommends python3 python3-venv libgomp1 ca-certificates; \
    rm -rf /var/lib/apt/lists/*; \
    npm install --omit=dev --no-package-lock; npm cache clean --force; \
    python3 -m venv /opt/piper/venv; \
    /opt/piper/venv/bin/pip install --no-cache-dir -r /tmp/piper-requirements.txt; \
    mkdir -p /opt/piper/voices; \
    /opt/piper/venv/bin/python -m piper.download_voices pt_BR-faber-medium --data-dir /opt/piper/voices; \
    chmod -R a+rX /opt/piper/voices
COPY --chown=node:node . .
ENV NODE_ENV=production PIPER_ENABLED=true PIPER_PYTHON=/opt/piper/venv/bin/python PIPER_MODEL=/opt/piper/voices/pt_BR-faber-medium.onnx
USER node
CMD ["node", "server.mjs"]
