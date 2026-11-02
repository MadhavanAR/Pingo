#!/usr/bin/env bash
# Publish website/ to an S3 bucket, optionally invalidating CloudFront.
#
#   S3_BUCKET=my-bucket [CLOUDFRONT_DISTRIBUTION_ID=E123...] ./scripts/deploy-aws.sh
#
# Requires the AWS CLI with credentials allowed to write the bucket.
set -euo pipefail

: "${S3_BUCKET:?Set S3_BUCKET to the target bucket name}"
SITE_DIR="$(cd "$(dirname "$0")/../website" && pwd)"

aws s3 sync "$SITE_DIR" "s3://$S3_BUCKET" \
  --delete \
  --exclude ".htaccess" \
  --exclude "vercel.json" \
  --cache-control "public, max-age=300"

if [[ -n "${CLOUDFRONT_DISTRIBUTION_ID:-}" ]]; then
  aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
    --paths "/*" >/dev/null
  echo "CloudFront invalidation requested."
fi

echo "Deployed to s3://$S3_BUCKET"
