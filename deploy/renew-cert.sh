#!/usr/bin/env bash

docker run --rm \
  -v /opt/ai-tax/frontend/dist:/webroot \
  -v /opt/ai-tax/ssl:/etc/letsencrypt \
  certbot/certbot renew --webroot -w /webroot --cert-name markweave.cloud --quiet \
  --post-hook "docker exec ai-tax-nginx nginx -s reload"
