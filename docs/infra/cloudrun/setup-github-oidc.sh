#!/usr/bin/env bash
set -euo pipefail

# Idempotently set up Workload Identity Federation for GitHub Actions OIDC.
# Allows a GitHub repository (any ref) to impersonate a GCP service account.
#
# Usage:
#   ./setup-github-oidc.sh <PROJECT_ID> <REPO> [--pool-id POOL] [--provider-id PROVIDER] [--sa-id SA_NAME] [--location LOCATION]
#     [--ar-repo REPO_NAME --ar-region REGION]
# Example:
#   ./setup-github-oidc.sh my-project amitxyz/myapp --pool-id github --provider-id github-oidc --sa-id gha-deployer

PROJECT_ID="${1:?PROJECT_ID required}"
REPO="${2:?REPO (e.g. owner/repo) required}"
shift 2

# Defaults
POOL_ID="github"
PROVIDER_ID="github-oidc"
SA_ID="gha-deployer"
LOCATION="global"

# Optional scoping for Artifact Registry writer grant
AR_REPO=""
AR_REGION=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pool-id)
      POOL_ID="${2:?--pool-id requires a value}"
      shift
      ;;
    --provider-id)
      PROVIDER_ID="${2:?--provider-id requires a value}"
      shift
      ;;
    --sa-id)
      SA_ID="${2:?--sa-id requires a value}"
      shift
      ;;
    --location)
      LOCATION="${2:?--location requires a value}"
      shift
      ;;
    --ar-repo)
      AR_REPO="${2:?--ar-repo requires a value}"
      shift
      ;;
    --ar-region)
      AR_REGION="${2:?--ar-region requires a value}"
      shift
      ;;
    *)
      echo "Unknown flag: $1" >&2
      exit 1
      ;;
  esac
  shift
done

SA_EMAIL="${SA_ID}@${PROJECT_ID}.iam.gserviceaccount.com"
PROJECT_NUM="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"

# Enable APIs required for Workload Identity Federation and OIDC token exchange.
# Needed so GitHub OIDC tokens can be exchanged for short-lived creds.
ensure_apis() {
  gcloud services enable iamcredentials.googleapis.com --project "${PROJECT_ID}" >/dev/null
  gcloud services enable sts.googleapis.com            --project "${PROJECT_ID}" >/dev/null
}

# Ensure the deployer service account exists.
# GitHub workflows will impersonate this SA to perform deployments.
ensure_service_account() {
  if ! gcloud iam service-accounts describe "${SA_EMAIL}" --project "${PROJECT_ID}" >/dev/null 2>&1; then

    gcloud iam service-accounts create "${SA_ID}" \
      --project "${PROJECT_ID}" \
      --display-name "GitHub Actions deployer"
  fi
}

# Ensure a Workload Identity Pool exists.
# Acts as a federation bridge between GitHub OIDC and GCP IAM.
ensure_workload_identity_pool() {
  if ! gcloud iam workload-identity-pools describe "${POOL_ID}" \
    --project="${PROJECT_ID}" \
    --location="${LOCATION}" >/dev/null 2>&1; then

    gcloud iam workload-identity-pools create "${POOL_ID}" \
      --project="${PROJECT_ID}" \
      --location="${LOCATION}" \
      --display-name="GitHub OIDC pool"
  fi
}

# Ensure an OIDC provider for GitHub within the pool.
# Defines issuer and maps token attributes used in IAM members.
ensure_oidc_provider() {
  if ! gcloud iam workload-identity-pools providers describe "${PROVIDER_ID}" \
    --project="${PROJECT_ID}" \
    --location="${LOCATION}" \
    --workload-identity-pool="${POOL_ID}" >/dev/null 2>&1; then

    gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_ID}" \
      --project="${PROJECT_ID}" \
      --location="${LOCATION}" \
      --workload-identity-pool="${POOL_ID}" \
      --display-name="GitHub OIDC provider" \
      --issuer-uri="https://token.actions.githubusercontent.com" \
      --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
      --attribute-condition="google.subject!=''"
  else
    gcloud iam workload-identity-pools providers update-oidc "${PROVIDER_ID}" \
      --project="${PROJECT_ID}" \
      --location="${LOCATION}" \
      --workload-identity-pool="${POOL_ID}" \
      --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
      --attribute-condition="google.subject!=''"
  fi
}

# Allow GitHub workflows from the specified repository (all refs) to
# impersonate the deployer service account via Workload Identity.
bind_repo_to_service_account() {
  local principal="principalSet://iam.googleapis.com/projects/${PROJECT_NUM}/locations/${LOCATION}/workloadIdentityPools/${POOL_ID}/attribute.repository/${REPO}"
  gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
    --project "${PROJECT_ID}" \
    --role "roles/iam.workloadIdentityUser" \
    --member "${principal}" >/dev/null
}

# Permissions: Artifact Registry writer
# Needed so the deployer SA can push container images. If AR_REPO and AR_REGION
# are provided, bind at repo scope (least privilege). Otherwise, grant project-wide
# writer role (broader) for convenience.
grant_artifact_registry_writer() {
  if [[ -n "${AR_REPO}" && -n "${AR_REGION}" ]]; then
    # repo-scoped binding
    if gcloud artifacts repositories describe "${AR_REPO}" --location "${AR_REGION}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
      gcloud artifacts repositories add-iam-policy-binding "${AR_REPO}" \
        --location "${AR_REGION}" \
        --project "${PROJECT_ID}" \
        --member "serviceAccount:${SA_EMAIL}" \
        --role "roles/artifactregistry.writer" >/dev/null
    else
      echo "WARN: Artifact Registry repo ${AR_REPO} (${AR_REGION}) not found; skipping writer binding" >&2
    fi
  else
    # project-scoped binding
    gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
      --member "serviceAccount:${SA_EMAIL}" \
      --role "roles/artifactregistry.writer" >/dev/null
  fi
}

# Permissions: Cloud Run deploy
# Needed so the deployer SA can create/update Cloud Run services and set runtime SAs.
# Grants run.admin for control-plane operations. Also grants iam.serviceAccountUser at
# project scope (no condition) so it can set any service account as the runtime identity.
grant_cloud_run_deploy() {
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member "serviceAccount:${SA_EMAIL}" \
    --role "roles/run.admin" >/dev/null

  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member "serviceAccount:${SA_EMAIL}" \
    --role "roles/iam.serviceAccountUser" >/dev/null
}

echo "==> Setting up GitHub OIDC for repo=${REPO} in project=${PROJECT_ID}"

ensure_apis
ensure_service_account
ensure_workload_identity_pool
ensure_oidc_provider
bind_repo_to_service_account
grant_artifact_registry_writer
grant_cloud_run_deploy

echo "✅ Done. Resources:"
echo "   Project ID:        ${PROJECT_ID}"
echo "   Project Number:    ${PROJECT_NUM}"
echo "   SA Email:          ${SA_EMAIL}"
echo "   Pool (location):   ${POOL_ID} (${LOCATION})"
echo "   Provider:          ${PROVIDER_ID}"
echo "   Allowed repository: ${REPO} (all refs)"
