import chalk from "chalk";
import fs from "fs";
import { globSync } from "glob";
import path from "path";
import type { PkgData, ProjectData } from "../types";
import { WorkspaceDependencies } from "./dependencies";
import { getImageData, getImageNames } from "./config";

const rootPkgJsonPath = path.join(process.cwd(), "package.json");
const rootPkgJson = JSON.parse(fs.readFileSync(rootPkgJsonPath, "utf8")) as {
  workspaces: string[];
};

const _workspaces: Record<string, ProjectData> = {};
let _workspacesLoaded = false;

function workspaces() {
  if (!_workspacesLoaded) {
    for (const workspaceGlob of rootPkgJson.workspaces) {
      globSync(path.join(workspaceGlob, "package.json")).forEach(
        (packageJsonPath) => {
          // Skip packages under node_modules directories in case hoisting did not work
          if (packageJsonPath.includes("node_modules")) return;
          const data = JSON.parse(
            fs.readFileSync(packageJsonPath, "utf8")
          ) as PkgData;
          const pkgName = data.name;
          const rootPath = path.dirname(packageJsonPath);
          _workspaces[pkgName] = { data, rootPath };
        }
      );
    }

    console.error(
      chalk.yellow(
        `Workspace Discovery initialized. Workspaces found: ${Object.keys(
          _workspaces
        ).join(", ")}`
      )
    );
    _workspacesLoaded = true;
  }
  return _workspaces;
}

const _imageDescendents: Record<string, string[]> = {};
let _imageDescendentsLoaded = false;

function imageDescendents() {
  if (!_imageDescendentsLoaded) {
    for (const imageName of getImageNames()) {
      const imageData = getImageData(imageName);
      const descendents = new Set<string>();
      imageData.applications.forEach((project) => {
        descendents.add(project);
        getDescendentNames(project).forEach((name) => descendents.add(name));
      });
      _imageDescendents[imageName] = Array.from(descendents);
    }
    _imageDescendentsLoaded = true;
  }
  return _imageDescendents;
}

const _workspaceImages: Record<string, string[]> = {};
let _workspaceImagesLoaded = false;

function workspaceImages() {
  if (!_workspaceImagesLoaded) {
    for (const [imageName, descendents] of Object.entries(imageDescendents())) {
      for (const workspaceName of descendents) {
        _workspaceImages[workspaceName] ??= [];
        _workspaceImages[workspaceName].push(imageName);
      }
    }
    _workspaceImagesLoaded = true;
  }
  return _workspaceImages;
}

export function workspaceNames() {
  return Object.keys(workspaces());
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

const dependencyResolve = new WorkspaceDependencies(workspaces);

/** Note: this includes the name of the provided workspace */
export function getDescendentNames(workspaceName: string) {
  const _ensurePresence = getWorkspace(workspaceName);
  return dependencyResolve.getDependents(workspaceName);
}

/** Note: this includes the provided workspace's data */
export function getDecendentData(workspaceName: string) {
  return getDescendentNames(workspaceName).map((name) => getWorkspace(name));
}

/** The dependent workspaces are specified in config/images.yaml */
export function getImageDescendentNames(imageName: string) {
  return imageDescendents()[imageName];
}

/** The dependent workspaces are specified in config/images.yaml */
export function getImageDescendentData(imageName: string) {
  return (
    getImageDescendentNames(imageName).map((name) => getWorkspace(name)) ?? []
  );
}

export function getImageDebugData(imageName: string): ProjectData {
  return {
    rootPath: "not-available",
    data: {
      name: `${imageName}-debug`,
      deployment: {
        manifest: "debug-console",
      },
    },
  };
}

export function getWorkspaceImages(workspaceName: string) {
  const _verifyPresence = getWorkspace(workspaceName);
  return workspaceImages()[workspaceName] ?? [];
}
