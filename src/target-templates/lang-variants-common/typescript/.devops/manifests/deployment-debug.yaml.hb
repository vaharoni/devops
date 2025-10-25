apiVersion: v1
kind: Pod
metadata:
  # Name and namespace should not be stated - they are provided by the runner
  labels:
    app: {{debug_pod_name}}
    env: {{monorepo_env}}
    ephemeral-shell: "true"
spec:
  volumes:
    - name: secret-injection-hook
      secret:
        secretName: {{env_secret_name}}
  containers:
    - image: {{image_path}}
      name: {{debug_pod_name}}
      stdin: true
      tty: true
      command:
      - ./node-exec.sh
      args:
      - /bin/bash
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
          cpu: 100m
