import chalk from "chalk";
import fs from "fs";
import { globSync } from "glob";
import path from "path";
import { packageFileNodeSchema, type PackageData } from "../../types";
import { PackageDataProcessor } from "./process-common";

const rootPath = process.env.MONOREPO_ROOT || process.cwd();
const rootPkgJsonPath = path.join(rootPath, "package.json");
const rootPkgJson = JSON.parse(fs.readFileSync(rootPkgJsonPath, "utf8")) as {
  workspaces: string[];
};

const _workspaces: Record<string, PackageData> = {};
let _workspacesLoaded = false;

export function nodeWorkspaces() {
  if (!_workspacesLoaded) {
    const allPackageJsons = (rootPkgJson.workspaces ?? []).flatMap(
      (workspaceGlob) =>
        globSync(path.join(rootPath, workspaceGlob, "package.json"))
    );

    const processor = new PackageDataProcessor({
      language: "node",
      pathList: allPackageJsons,
      zodSchema: packageFileNodeSchema,
      fileParser: JSON.parse,
      nameExtractor: (data) => data.name,
    });

    processor
      .convert((data) => {
        const { dependencies, ...rest } = data;
        const dependencyNames = Object.keys(dependencies ?? []);
        return {
          ...rest,
          dependencyNames: processor.filterDependencies(dependencyNames),
        };
      })
      .forEach((pkgData) => {
        _workspaces[pkgData.name] = pkgData;
      });

    console.warn(
      chalk.yellow(
        // prettier-ignore
        `Node workspace discovery initialized. Workspaces found: ${Object.keys(_workspaces).join(", ")}`
      )
    );
    _workspacesLoaded = true;
  }
  return _workspaces;
}
