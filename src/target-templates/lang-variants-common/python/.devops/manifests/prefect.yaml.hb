{{#each prefectFlows}}
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app: {{../app_name}}
    env: {{../monorepo_env}}
  name: {{../app_name}}-{{flow_name}}
  namespace: {{../namespace}}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: {{../app_name}}
  template:
    metadata:
      labels:
        app: {{../app_name}}
        env: {{../monorepo_env}}
    spec:
      # The application does not use the service account token. Leaving it out keeps it from reading secrets via the API.
      automountServiceAccountToken: false
      volumes:
        - name: secret-injection-hook
          secret:
            secretName: {{../env_secret_name}}
        - name: materialized-env
          emptyDir:
            medium: Memory
            sizeLimit: 1Mi
      # Only this init container mounts the secret. It writes to materialized-env the env variables declared in the
      # env.yaml files of the workspace and its dependencies, which is all the main container gets.
      initContainers:
        - name: materialize-env
          image: {{../image_path}}
          command:
            - ./materialize-env.sh
          args:
            - "{{../project_name}}"
          volumeMounts:
            - name: secret-injection-hook
              mountPath: /etc/kubernetes/secrets
              readOnly: true
            - name: materialized-env
              mountPath: /app/config
          resources:
            requests:
              memory: 50Mi
              cpu: 50m
      containers:
        - image: {{../image_path}}
          name: {{flow_name}}
          command:
            - ./python-exec.sh
          args:
            - ./devopspy
            - exec
            - --in
            - {{../app_name}}
            - python
            - -m
            - {{script_path}}
          env:
            - name: PREFECT_API_URL
              value: http://prefect-server.prefect-{{../monorepo_env}}:4200/api
            - name: MONOREPO_ENV
              value: {{../monorepo_env}}
            - name: MONOREPO_NAMESPACE
              value: {{../namespace}}
            - name: IS_KUBERNETES
              value: 'true'
            - name: MONOREPO_BASE_SECRET
              valueFrom:
                secretKeyRef:
                  name: {{../env_secret_name}}
                  key: {{../env_base_secret_key}}
          volumeMounts:
            - name: materialized-env
              mountPath: /app/config
              readOnly: true
          resources:
            requests:
              memory: 250Mi
              cpu: 250m
{{#unless @last}}
---
{{/unless}}
{{/each}}