# Upgrading

`bunx devops init` copies templates (Dockerfiles, entry scripts, manifests, github actions) into your repo. Those copies
are yours, so a new devops version does not change them. This page lists the changes to apply when upgrading.

## Scoped env injection and build secrets

Starting with this version:
- devops loads `.env` files itself. `@dotenvx/dotenvx` is no longer used, so you can remove it from your root
  `package.json`.
- `devops prep-build` no longer creates `config/` inside the build folder. The build env goes to
  `<build-folder>.build-env`, which docker must receive as a build secret.
- `devops run <workspace>:<script>` and `devops exec --in <workspace>` inject only the variables declared in the
  `env.yaml` files of the workspace and its dependencies, plus `MONOREPO_*`. Declare any variable your code reads.
- `devops cloudrun deploy` forwards the variables declared in the image's `env.yaml` files automatically.

Apply the following to your copies. Compare with the files under `src/target-templates/lang-variants-common` in this
package for the full versions.

1. **`.devops/docker-images/common/docker-common.sh`**: replace with the new version. `setup_config` now writes values
   single-quoted, which keeps them literal, and the new `materialize_env` function filters the secret for a workspace.
2. **`.devops/docker-images/common/materialize-env.sh`**: add this file. It is the init container's entrypoint, and it
   must be executable (`chmod +x`).
3. **Dockerfiles** (`node-services`, `cloudrun`, `python-services`): add `# syntax=docker/dockerfile:1` at the top.
   Then add the secret mount to every `RUN` step that needs env variables, typically `generate` and `build`:
   ```dockerfile
   RUN --mount=type=secret,id=env,target=/app/config/.env.global,required=true ./devops run-many build
   ```
   Keep `RUN rm -rf config/` at the end.
4. **`.github/actions/common/build-image@v1/action.yaml`**: after `mv $folder /home/runner/build`, add
   `mv $folder.build-env /home/runner/build.env`. Then pass it to `docker/build-push-action`:
   ```yaml
   secret-files: |
     env=/home/runner/build.env
   ```
   Finally, add an `if: always()` step that runs `rm -f /home/runner/build.env`.
5. **Manifests** (`deployment-web`, `deployment-process`, `cron-jobs`, `db-migrate-job`, `prefect`, and any custom
   ones), for each pod spec:
   - Add `automountServiceAccountToken: false`, unless your application talks to the Kubernetes API.
   - Add an `emptyDir` volume named `materialized-env` with `medium: Memory`.
   - Add the `materialize-env` init container. It runs `./materialize-env.sh <workspace>` and mounts both the secret (at
     `/etc/kubernetes/secrets`) and `materialized-env` (at `/app/config`). In `db-migrate-job`, the workspace is `db`.
   - In the application container, replace the secret mount with `materialized-env` mounted read-only at `/app/config`.

   Leave `deployment-debug` as is, so `devops console` keeps getting every variable.

Steps 1-4 must go together, because a build without the secret mount runs without env variables. Step 5 can follow
later: pods that still mount the secret keep receiving every variable through `setup_config`. Images built before
this version have no `.devops/env-keys.json`, so if one is deployed with the new manifests (e.g. on rollback), the init
container falls back to injecting every variable.
