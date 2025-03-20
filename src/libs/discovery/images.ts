import { getWorkspace, workspaceDirectoryForLanguage } from ".";
import type { PackageData } from "../../types";
import { getImageData, getImageNames } from "../config";
import { WorkspaceDependencies } from "./dependencies";

// = From images to workspaces

const _imageDescendents: Record<string, PackageData[]> = {};
let _imageDescendentsLoaded = false;

function imageDescendents() {
  if (!_imageDescendentsLoaded) {
    for (const imageName of getImageNames()) {
      const descendents = new Set<string>();
      const imageData = getImageData(imageName);
      const workspaces = workspaceDirectoryForLanguage(imageData.language);
      const dependencyResolver = new WorkspaceDependencies(() => workspaces)
      imageData.applications.forEach((workspace) => {
        dependencyResolver.getDependents(workspace).forEach((name) => descendents.add(name));
      });
      _imageDescendents[imageName] = Array.from(descendents).map(name => workspaces[name]);
    }
    _imageDescendentsLoaded = true;
  }
  return _imageDescendents;
}

/** The dependent workspaces are specified in config/images.yaml */
export function getImageDescendentData(imageName: string) {
  return (
    imageDescendents()[imageName] ?? []
  );
}

// = From workspace to images

const _workspaceImages: Record<string, string[]> = {};
let _workspaceImagesLoaded = false;

function workspaceImages() {
  if (!_workspaceImagesLoaded) {
    for (const [imageName, descendents] of Object.entries(imageDescendents())) {
      for (const packageData of descendents) {
        _workspaceImages[packageData.name] ??= [];
        _workspaceImages[packageData.name].push(imageName);
      }
    }
    _workspaceImagesLoaded = true;
  }
  return _workspaceImages;
}


export function getWorkspaceImages(workspaceName: string) {
  const _verifyPresence = getWorkspace(workspaceName);
  return workspaceImages()[workspaceName] ?? [];
}
