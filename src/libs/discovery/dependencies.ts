import chalk from "chalk";
import type { PackageData } from "../../types";

export class WorkspaceDependencies {
  dependencies: Record<string, DependencyNode> = {};
  loaded = false;
  workspaces: Record<string, PackageData> = {};

  constructor(public getAllProjects: () => Record<string, PackageData>) {}

  _getOrCreate(name: string) {
    let node = this.dependencies[name];
    if (!node) {
      node = new DependencyNode(name);
      this.dependencies[name] = node;
    }
    return node;
  }

  _buildTree() {
    this.workspaces = this.getAllProjects();
    this.loaded = true;
    for (const workspace of Object.keys(this.workspaces)) {
      const node = this._getOrCreate(workspace);
      const data = this.workspaces[workspace];
      for (const dep of data.dependencyNames ?? []) {
        if (this.workspaces[dep]) {
          node.dependsOn.add(dep);
        }
      }
    }
  }

  getDependents(workspaceName: string) {
    if (!this.loaded) {
      this._buildTree();
    }
    const node = this.dependencies[workspaceName];
    if (!node) {
      console.error(chalk.red(`\nWorkspace ${workspaceName} not found\n`));
      process.exit(1);
    }
    return node.flattenDependents(this.dependencies);
  }
}

class DependencyNode {
  name: string;
  dependsOn: Set<string>;

  constructor(name: string) {
    this.name = name;
    this.dependsOn = new Set();
  }

  flattenDependents(
    allDependencies: Record<string, DependencyNode>,
    visited?: Set<string>
  ) {
    visited ??= new Set();
    visited.add(this.name);
    const notVisitedDependents: string[] = [];
    for (const dep of this.dependsOn) {
      if (!visited.has(dep)) {
        const node = allDependencies[dep];
        notVisitedDependents.push(
          ...node.flattenDependents(allDependencies, visited)
        );
      }
    }
    return [this.name, ...notVisitedDependents];
  }
}
