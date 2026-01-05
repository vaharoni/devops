import chalk from "chalk";
import fs from "fs";
import { globSync } from "glob";
import { packageFilePythonSchema, type PackageData } from "../../types";
import { PackageDataProcessor } from "./process-common";
import TOML from "@iarna/toml";
import path from "path";

const rootPath = process.env.MONOREPO_ROOT || process.cwd();
const rootPyprojectPath = path.join(rootPath, "pyproject.toml");
const _workspaces: Record<string, PackageData> = {};
let _workspacesLoaded = false;

export function pythonWorkspaces() {
  if (_workspacesLoaded) return _workspaces;

  // No root pyproject.toml means no Python workspaces - skip discovery
  if (!fs.existsSync(rootPyprojectPath)) {
    _workspacesLoaded = true;
    return _workspaces;
  }

  const rootPyproject = TOML.parse(
    fs.readFileSync(rootPyprojectPath, "utf8")
  ) as { tool?: { uv?: { workspace?: { members?: string[] } } } };
  const workspaceMembers: string[] =
    rootPyproject?.tool?.uv?.workspace?.members ?? [];

  const allPyprojectTomls = workspaceMembers.flatMap((member) =>
    globSync(path.join(rootPath, member, "pyproject.toml"))
  );

  const processor = new PackageDataProcessor({
    language: "python",
    pathList: allPyprojectTomls,
    zodSchema: packageFilePythonSchema,
    fileParser: TOML.parse,
    nameExtractor: (data) => data.project.name,
  });

  processor
    .convert((data) => {
      const deployment = data.tool?.devops?.deployment;
      const scripts = data.tool?.devops?.scripts;
      const dependencyNames = data.project.dependencies ?? [];
      return {
        scripts,
        deployment,
        dependencyNames: processor.filterDependencies(dependencyNames),
      };
    })
    .forEach((pkgData) => {
      _workspaces[pkgData.name] = pkgData;
    });

  console.warn(
    chalk.yellow(
      // prettier-ignore
      `Python workspace discovery initialized. Workspaces found: ${Object.keys(_workspaces).join(", ")}`
    )
  );
  _workspacesLoaded = true;
  return _workspaces;
}
