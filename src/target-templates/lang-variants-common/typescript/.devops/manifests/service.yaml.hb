apiVersion: v1
kind: Service
metadata:
  name: {{service_name}}
  labels:
    app: {{app_name}}
    env: {{monorepo_env}}
  namespace: {{namespace}}
spec:
  selector:
    app: {{app_name}}
  ports:
    - protocol: TCP
      port: 80
      targetPort: {{port}}
