{{#each cronJobs}}
apiVersion: batch/v1
kind: CronJob
metadata:
  labels:
    app: {{../app_name}}
    env: {{../monorepo_env}}
  name: {{name}}
  namespace: {{../namespace}}
spec:
  schedule: "{{cron}}"
  jobTemplate:
    spec:
      ttlSecondsAfterFinished: 86400
      template:
        spec:
          volumes:
            - name: secret-injection-hook
              secret:
                secretName: {{../env_secret_name}}
          containers:
            - image: {{../image_path}}
              name: {{name}}
              command:
                - node-exec.sh
              args:
                - devops
                - internal-curl
                {{#each curl}}
                - {{this}}
                {{/each}}
              env:
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
                - name: secret-injection-hook
                  mountPath: /etc/kubernetes/secrets
                  readOnly: true
              resources:
                requests:
                  memory: 250Mi
          restartPolicy: Never
{{#unless @last}}
---
{{/unless}}
{{/each}}