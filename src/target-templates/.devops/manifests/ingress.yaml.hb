apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{app_name}}
  namespace: {{namespace}}
  labels:
    app: {{app_name}}
    env: {{monorepo_env}}
spec:
  ingressClassName: nginx
  rules:
    - host: {{subdomain}}.{{domain_name}}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {{service_name}}
                port:
                  number: 80
