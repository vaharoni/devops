#!/usr/bin/env bash
set -euo pipefail

# Idempotently enable services and create an Artifact Registry repo for Cloud Run images.
# Usage:
#   ./setup-cloudrun.sh <PROJECT_ID> <REGION> <REPOSITORY>
# Example:
#   ./setup-cloudrun.sh my-project europe-west1 cloudrun

PROJECT_ID="${1:?PROJECT_ID required}"
REGION="${2:?REGION required}"
REPOSITORY="${3:?REPOSITORY required}"

curr_folder=$(dirname "${BASH_SOURCE[0]}")
retention_policy_file="${curr_folder}/retention-policy.json"

ensure_apis() {
  gcloud services enable artifactregistry.googleapis.com --project "${PROJECT_ID}" >/dev/null
  gcloud services enable run.googleapis.com               --project "${PROJECT_ID}" >/dev/null
}

ensure_artifact_repo() {
  if ! gcloud artifacts repositories describe "${REPOSITORY}" \
    --location="${REGION}" \
    --project="${PROJECT_ID}" >/dev/null 2>&1; then

    gcloud artifacts repositories create "${REPOSITORY}" \
      --repository-format=docker \
      --location="${REGION}" \
      --description="Container images for Cloud Run" \
      --project="${PROJECT_ID}"
  fi
}

apply_retention_policy() {
  gcloud artifacts repositories set-cleanup-policies "${REPOSITORY}" \
    --location="${REGION}" \
    --project="${PROJECT_ID}" \
    --policy="${retention_policy_file}"
}

ensure_apis
ensure_artifact_repo
apply_retention_policy

REPO_PATH="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}"

echo "✅ Services enabled and repository ensured."
echo "REPO_PATH=${REPO_PATH}"
echo "Project:    ${PROJECT_ID}"
echo "Region:     ${REGION}"
echo "Repository: ${REPOSITORY}"
echo ""
echo "Next steps:"
echo "- Set in constants.yaml"
echo "    cloudrun-artifact-registry-repo-path: ${REPO_PATH}"
