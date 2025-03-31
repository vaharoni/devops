import chalk from "chalk";
import { globSync } from "glob";
import { packageFilePythonSchema, type PackageData } from "../../types";
import { PackageDataProcessor } from "./process-common";
import TOML from '@iarna/toml';

const _workspaces: Record<string, PackageData> = {};
let _workspacesLoaded = false;

export function pythonWorkspaces() {
  if (!_workspacesLoaded) {
    const allPyprojectTomls = globSync("**/*/pyproject.toml");
    const processor = new PackageDataProcessor({
      language: "python",
      pathList: allPyprojectTomls,
      zodSchema: packageFilePythonSchema,
      fileParser: TOML.parse,
      nameExtractor: (data) => data.project.name,
    });

    processor.convert((data) => {
      const deployment = data.tool?.devops?.deployment;
      const scripts = data.tool?.devops?.scripts;
      const dependencyNames = data.project.dependencies ?? [];
      return {
        scripts,
        deployment,
        dependencyNames: processor.filterDependencies(dependencyNames)
      }
    }).forEach(pkgData => {
      _workspaces[pkgData.name] = pkgData
    })

    console.warn(
      chalk.yellow(
        // prettier-ignore
        `Python workspace discovery initialized. Workspaces found: ${Object.keys(_workspaces).join(", ")}`
      )
    );
    _workspacesLoaded = true;
  }
  return _workspaces;
}