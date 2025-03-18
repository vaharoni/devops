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
      volumes:
        - name: secret-injection-hook
          secret:
            secretName: {{env_secret_name}}
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
            - name: secret-injection-hook
              mountPath: /etc/kubernetes/secrets
              readOnly: true
          resources:
            requests:
              memory: 100Mi
      restartPolicy: Never
  backoffLimit: 0
  ttlSecondsAfterFinished: 3600
