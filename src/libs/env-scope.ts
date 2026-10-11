import _ from "lodash";
import { getWorkspace, globEnvYamlFiles, workspaceDirectoryForLanguage } from "./discovery";
import { WorkspaceDependencies } from "./discovery/dependencies";
import { SingleEnvValidator, type EnvRequirement } from "./validate-env";
import type { SupportedLanguages } from "../types";

/**
 * Env file variables with this prefix are framework-level and are always injected, regardless of scope.
 * The same rule is applied when materializing the env of a pod (see materialize_env in docker-common.sh).
 */
export const ALWAYS_INJECTED_PREFIX = "MONOREPO_";

/** Returns the names of the workspace and all the workspaces it depends on, transitively */
export function workspaceClosure(workspaceName: string, language?: SupportedLanguages): string[] {
  const languages = language
    ? [language]
    : getWorkspace(workspaceName).packageDataEntries.map((x) => x.language);
  const names = new Set<string>();
  for (const lang of languages) {
    const resolver = new WorkspaceDependencies(() => workspaceDirectoryForLanguage(lang));
    resolver.getDependents(workspaceName).forEach((name) => names.add(name));
  }
  return Array.from(names);
}

/** The env.yaml files that apply to a workspace: its own and those of all its dependencies */
export function workspaceEnvYamlFiles(workspaceName: string, language?: SupportedLanguages): string[] {
  return globEnvYamlFiles(workspaceClosure(workspaceName, language));
}

/**
 * Merges the requirements declared in the given env.yaml files. When a key is declared in multiple files,
 * a non-optional requirement takes precedence over "optional". Exits on parsing errors.
 */
export function envRequirementsFromFiles(envYamlFiles: string[]): Record<string, EnvRequirement> {
  const result: Record<string, EnvRequirement> = {};
  for (const file of envYamlFiles) {
    const validator = new SingleEnvValidator(file);
    const parsed = validator.parse();
    if (validator.parsingError) {
      console.error(validator.parsingError);
      process.exit(1);
    }
    for (const [key, requirement] of Object.entries(parsed ?? {})) {
      if (result[key] === undefined || result[key] === "optional") result[key] = requirement;
    }
  }
  return result;
}

export function workspaceEnvRequirements(workspaceName: string, language?: SupportedLanguages) {
  return envRequirementsFromFiles(workspaceEnvYamlFiles(workspaceName, language));
}

/** Keeps only the variables declared by the workspace's env.yaml closure, plus framework-level variables */
export function scopeEnvToWorkspace(vars: Record<string, string>, workspaceName: string): Record<string, string> {
  const allowed = new Set(Object.keys(workspaceEnvRequirements(workspaceName)));
  return _.pickBy(vars, (_value, key) => allowed.has(key) || key.startsWith(ALWAYS_INJECTED_PREFIX));
}
