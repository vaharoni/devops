import chalk from "chalk";
import { nodeWorkspaces } from "./process-package-json";
import { pythonWorkspaces } from "./process-pyproject-toml";
import type { SupportedLanguages, WorkspaceIndex } from "../../types";

const _workspaces: WorkspaceIndex = {};
let _workspacesLoaded = false;

export function workspaces() {
  if (_workspacesLoaded) return _workspaces;
  const nodeWorkspacesData = nodeWorkspaces();
  const pythonWorkspacesData = pythonWorkspaces();

  Object.values(nodeWorkspacesData).forEach((data) => {
    _workspaces[data.name] = {
      rootPath: data.rootPath,
      packageDataEntries: [data],
    };
  });

  Object.values(pythonWorkspacesData).forEach((data) => {
    const existing = _workspaces[data.name];
    if (existing) {
      if (existing.rootPath !== data.rootPath) {
        // prettier-ignore
        console.error(chalk.red(`\nWorkspace ${data.name} has conflicting root paths:\n\t${existing.rootPath}\n\t${data.rootPath}\n`));
        process.exit(1);
      }
    } else {
      _workspaces[data.name] = {
        rootPath: data.rootPath,
        packageDataEntries: [],
      };
    }
    _workspaces[data.name].packageDataEntries.push(data);
  });
  _workspacesLoaded = true;
  return _workspaces;
}

export function workspaceDirectoryForLanguage(language: SupportedLanguages) {
  switch (language) {
    case "node":
      return nodeWorkspaces();
    case "python":
      return pythonWorkspaces();
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}

export function getWorkspace(workspaceName: string) {
  const workspace = workspaces()[workspaceName];
  if (!workspace) {
    console.error(chalk.red(`\nWorkspace ${workspaceName} not found\n`));
    // The gha relies on the 13 exit code for "not found"
    process.exit(13);
  }
  return workspace;
}
