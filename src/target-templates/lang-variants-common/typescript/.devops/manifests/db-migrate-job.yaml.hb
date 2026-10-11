apiVersion: batch/v1
kind: Job
metadata:
  name: {{db_migrate_job_name}}
  namespace: {{namespace}}
  labels:
    env: {{monorepo_env}}
spec:
  template:
    spec:
      # The application does not use the service account token. Leaving it out keeps it from reading secrets via the API.
      automountServiceAccountToken: false
      volumes:
        - name: secret-injection-hook
          secret:
            secretName: {{env_secret_name}}
        - name: materialized-env
          emptyDir:
            medium: Memory
            sizeLimit: 1Mi
      # Only this init container mounts the secret. It writes to materialized-env the env variables declared in the
      # env.yaml files of the workspace and its dependencies, which is all the main container gets.
      initContainers:
        - name: materialize-env
          image: {{image_path}}
          command:
            - ./materialize-env.sh
          args:
            - "db"
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
        - name: db-migrate-job
          image: {{image_path}}
          args:
            - db
            - migrate-deploy
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
            - name: materialized-env
              mountPath: /app/config
              readOnly: true
          resources:
            requests:
              memory: 100Mi
              cpu: 250m
      restartPolicy: Never
  backoffLimit: 0
  ttlSecondsAfterFinished: 3600
