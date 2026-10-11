/** Path of the file holding the env variables needed by an image build. It sits outside the build context on purpose. */
export function buildEnvPathFor(buildFolder: string) {
  return `${buildFolder}.build-env`;
}

/** Path inside the image of the file mapping each workspace to the env variables it declares (see materialize_env) */
export const ENV_KEYS_FILE = ".devops/env-keys.json";
