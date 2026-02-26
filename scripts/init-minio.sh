#!/bin/sh
set -e

until mc alias set myminio http://minio:9000 minioadmin minioadmin; do
  echo "Waiting for MinIO..."
  sleep 2
done

mc mb myminio/openloom --ignore-existing

mc anonymous set download myminio/openloom

cat > /tmp/cors.json << 'EOF'
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}
EOF

mc cors set myminio/openloom /tmp/cors.json 2>/dev/null || true

echo "MinIO initialized: bucket=openloom, CORS=enabled, public-read=enabled"
