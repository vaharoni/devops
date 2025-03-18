apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app: {{debug_pod_name}}
    env: {{monorepo_env}}
  name: {{debug_pod_name}}
  namespace: {{namespace}}
spec:
  selector:
    matchLabels:
      app: {{debug_pod_name}}
  template:
    metadata:
      labels:
        app: {{debug_pod_name}}
        env: {{monorepo_env}}
    spec:
      volumes:
        - name: secret-injection-hook
          secret:
            secretName: {{env_secret_name}}
      containers:
        - image: {{image_path}}
          name: {{debug_pod_name}}
          env:
            - name: MONOREPO_ENV
              value: {{monorepo_env}}
            - name: MONOREPO_NAMESPACE
              value: {{namespace}}
            - name: IS_KUBERNETES
              value: 'true'
            - name: MONOREPO_BASE_SECRET
              valueFrom:
                secretKeyRef:
                  name: {{env_secret_name}}
                  key: {{env_base_secret_key}}
          volumeMounts:
            - name: secret-injection-hook
              mountPath: /etc/kubernetes/secrets
              readOnly: true
          resources:
            requests:
              memory: 250Mi
