import chalk from "chalk";
import type { ProjectData } from "../types";

export class WorkspaceDependencies {
  dependencies: Record<string, DependencyNode> = {};
  loaded = false;
  projects: Record<string, ProjectData> = {};

  constructor(public getAllProjects: () => Record<string, ProjectData>) {}

  _getOrCreate(name: string) {
    let node = this.dependencies[name];
    if (!node) {
      node = new DependencyNode(name);
      this.dependencies[name] = node;
    }
    return node;
  }

  _buildTree() {
    this.projects = this.getAllProjects();
    this.loaded = true;
    for (const workspace of Object.keys(this.projects)) {
      const node = this._getOrCreate(workspace);
      const { data } = this.projects[workspace];
      for (const dep in data.dependencies ?? []) {
        if (this.projects[dep]) {
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
