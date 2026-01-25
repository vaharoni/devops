#!/usr/bin/env bash
set -euo pipefail

# Create/ensure a runtime service account for a Cloud Run service.
# This configures a dedicated runtime identity that your Cloud Run service will run as.
#
# IMPORTANT: This script is a template. You should modify the granted roles based on
# what your specific Cloud Run service needs to access. The example below grants
# Pub/Sub publisher, but your service may need different permissions (e.g., Cloud SQL,
# Secret Manager, Cloud Storage, etc.).
#
# Usage:
#   ./setup-runtime-service-account.sh <PROJECT_ID> <SA_ID>
# Example:
#   ./setup-runtime-service-account.sh my-project runtime-my-service

PROJECT_ID="${1:?PROJECT_ID required}"
SA_ID="${2:?SA_ID required}"

SA_EMAIL="${SA_ID}@${PROJECT_ID}.iam.gserviceaccount.com"

# Ensure the runtime service account exists. Cloud Run services will run as this identity.
ensure_service_account() {
  if ! gcloud iam service-accounts describe "${SA_EMAIL}" --project "${PROJECT_ID}" >/dev/null 2>&1; then

    gcloud iam service-accounts create "${SA_ID}" \
      --project "${PROJECT_ID}" \
      --display-name "Runtime - ${SA_ID}"
  fi
}

# ============================================================================
# CUSTOMIZE THE PERMISSIONS BELOW BASED ON YOUR SERVICE'S NEEDS
# ============================================================================

# Example: Grant Pub/Sub publisher (modify or remove as needed)
grant_pubsub_publisher() {
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member "serviceAccount:${SA_EMAIL}" \
    --role "roles/pubsub.publisher" >/dev/null
}

# Example: Grant Secret Manager access (uncomment if needed)
# grant_secret_manager_access() {
#   gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
#     --member "serviceAccount:${SA_EMAIL}" \
#     --role "roles/secretmanager.secretAccessor" >/dev/null
# }

# Example: Grant Cloud SQL client (uncomment if needed)
# grant_cloudsql_client() {
#   gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
#     --member "serviceAccount:${SA_EMAIL}" \
#     --role "roles/cloudsql.client" >/dev/null
# }

# Example: Grant Cloud Storage read (uncomment if needed)
# grant_storage_read() {
#   gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
#     --member "serviceAccount:${SA_EMAIL}" \
#     --role "roles/storage.objectViewer" >/dev/null
# }

# ============================================================================

echo "==> Setting up runtime service account for Cloud Run (PROJECT=${PROJECT_ID})"

ensure_service_account
grant_pubsub_publisher  # Modify this line based on your needs

echo "✅ Done. Resources:"
echo "   Runtime SA:   ${SA_EMAIL}"
echo ""
echo "Remember to customize the granted roles in this script based on your service's needs."
