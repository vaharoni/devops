The below was done thinking it was required to have all Ingress behind TLS to allow "Full" encryption mode on Cloudflare. However, it seems that turning encryption mode to "Full" is enough without requiring any changes to the Ingresses.

## Changes to k8s generators

In `k8s/templates/env-setup.yaml`, add the following to create a wildcard certificate per domain:

```yaml
---
# Note: this may not be needed even when Cloudflare TLS encryption mode is full
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: wildcard-cert
  namespace: $MONOREPO_NAMESPACE
spec:
  secretName: wildcard-cert
  issuerRef:
    name: letsencrypt-dns01
    kind: ClusterIssuer
  dnsNames:
    - "*.$MONOREPO_DOMAIN_NAME"
```

In `k8s/templates/ingress.yaml`, add the following under `spec` to use that wildcard certificate:

```yaml
tls:
  - hosts:
      - $MONOREPO_PKG_SUBDOMAIN.$MONOREPO_DOMAIN_NAME
    secretName: wildcard-cert
```
