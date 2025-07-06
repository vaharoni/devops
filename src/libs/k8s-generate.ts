import type { PackageData, TemplateDbMigrateObject, TemplateDebugObject, TemplateDeploymentObject, TemplateSharedContext } from "../types";
import { BASE_SECRET_KEY } from "./k8s-namespace";
import { containerRegistryRepoPath, dbMigrateJobName, domainNameForEnv, envToNamespace, imageDebugName, MISSING_DOMAIN_KEY_ERROR, secretName } from "./k8s-constants";
import { getWorkspaceScale } from "./k8s-image-config";
import path from "path";
import yaml from "yaml";
import fs from 'fs';
import { globSync } from "glob";
import _, { template } from 'lodash';
import Handlebars from "handlebars";
import { getImageData } from "./config";
import { getImageDescendentData } from "./discovery/images";

const MANIFEST_FOLDER_PATH = path.join(process.cwd(), '.devops/manifests');
const MANIFEST_INDEX_FILE_PATH = path.join(MANIFEST_FOLDER_PATH, '_index.yaml');
const DB_MIGRATE_TEMPLATE_NAME = 'db-migrate';

type RenderFn = (template: string) => string;

// = Interface

export function generateImageDeployments(
  monorepoEnv: string,
  image: string,
  gitSha: string
) {
  const generator = new ImageContextGenerator(monorepoEnv, image, gitSha);
  const apps = getImageDescendentData(image)
    .filter((packageData) => packageData.deployment)
    .flatMap((projectData) => {
      const context = generator.getDeployment(projectData);
      const renderFn = (template: string) => Handlebars.compile(template)(context);
      return generateManifestForDeployment(projectData.rootPath, projectData.deployment!.template, renderFn);
    });
  const debug = generateDebugDeployment(monorepoEnv, image, gitSha);
  const manifest = [debug, ...apps].join("\n---\n");
  return ensureProperDomainsPresent(manifest, monorepoEnv, image);
}

export function generateWorkspaceDeployment(packageData: PackageData, monorepoEnv: string, image: string, gitSha: string) {
  const generator = new ImageContextGenerator(monorepoEnv, image, gitSha);
  const context = generator.getDeployment(packageData);
  const renderFn = (template: string) => Handlebars.compile(template)(context);
  const manifest = generateManifestForDeployment(packageData.rootPath, packageData.deployment!.template, renderFn).join("\n---\n");
  return ensureProperDomainsPresent(manifest, monorepoEnv, image);
}

export function generateDebugDeployment(
  monorepoEnv: string,
  image: string,
  gitSha: string
) {
  const generator = new ImageContextGenerator(monorepoEnv, image, gitSha);
  const context = generator.getDebug();
  const renderFn = (template: string) => Handlebars.compile(template)(context);
  const debugTemplate = getImageData(image)["debug-template"];
  return generateManifestsFromTemplateName(debugTemplate, renderFn).map(x => yaml.stringify(x)).join("\n---\n");
}

export function generateDbMigrateJob(
  monorepoEnv: string,
  image: string,
  gitSha: string
) {
  const generator = new ImageContextGenerator(monorepoEnv, image, gitSha);
  const context = generator.getDbMigrate();
  const renderFn = (template: string) => Handlebars.compile(template)(context);
  return generateManifestsFromTemplateName(DB_MIGRATE_TEMPLATE_NAME, renderFn).map(x => yaml.stringify(x)).join("\n---\n");
}

// = Verification

function ensureProperDomainsPresent(manifest: string, monorepoEnv: string, image: string) {
  if (manifest.includes(MISSING_DOMAIN_KEY_ERROR)) {
    console.error(`The image ${image} does not have a domain defined for the environment ${monorepoEnv}. Please add it to the .devops/config/images.yaml.`);
    process.exit(1);
  }
  return manifest;
}

// = Generation logic

// L1 generation: composite

function generateManifestForDeployment(rootPath: string, templateName: string, renderFn: RenderFn): string[] {
  const defaults = generateManifestsFromTemplateName(templateName, renderFn);
  const overrides = generateManifestFromFilesInFolder(rootPath, renderFn);
  const keyExtractor = (manifest: { kind: string, metadata: { name: string } }) => `${manifest.kind}-${manifest.metadata.name}`;
  const defaultTemplateLookup = _.keyBy(defaults, keyExtractor);
  const overrideTemplateLookup = _.keyBy(overrides, keyExtractor);
  const mergedTemplates = _.merge(defaultTemplateLookup, overrideTemplateLookup);
  return Object.values(mergedTemplates).map(x => yaml.stringify(x));
}

// L2 generation

function generateManifestsFromTemplateName(templateName: string, renderFn: RenderFn): object[] {
  const entries = manifestFilesForTemplate(templateName);
  if (!entries) {
    console.error(`No entries found for ${templateName} in ${MANIFEST_INDEX_FILE_PATH}`);
    process.exit(1);
  }
  return generateManifestsFromFileList(entries.map(entry => path.join(MANIFEST_FOLDER_PATH, entry)), renderFn);  
}

// L2 generation

function generateManifestFromFilesInFolder(folderPath: string, renderFn: RenderFn): object[] {
  const manifestOverridePath = path.join(folderPath, 'manifests');
  if (!fs.existsSync(manifestOverridePath)) {
    return []
  }
  const files = globSync(path.join(manifestOverridePath, '**/*')).filter(x => fs.lstatSync(x).isFile());
  return generateManifestsFromFileList(files, renderFn);
}

// L3 generation

function generateManifestsFromFileList(filesList: string[], renderFn: RenderFn): object[] {
  return filesList.flatMap((filePath) => {
    try {
      const manifestFileStr = fs.readFileSync(filePath, 'utf8');
      const renderedStr = renderFn(manifestFileStr);
      const res = yaml.parseAllDocuments(renderedStr);
      res.forEach((doc) => {
        if (!doc.get("kind") || !doc.getIn(["metadata", "name"])) {
          console.error(`Invalid manifest file ${filePath}: kind and metadata.name must be present`);
          console.error(doc.toString())
          process.exit(1);
        }          
      })
      return res.map(x => x.toJSON());
    } catch (e) {
      if (e instanceof Error) {
        console.error(`Could not parse ${filePath}: ${e.message}`);
      } else {
        console.error(`Could not parse ${filePath}`);
      }
      process.exit(1);
    }
  })
}

// Infra: the template index file

let _manifestIndex: Record<string, string[]>;
function manifestFilesForTemplate(template: string) {
  if (!_manifestIndex) {
    try {
      const indexFileStr = fs.readFileSync(MANIFEST_INDEX_FILE_PATH, 'utf8');
      _manifestIndex = yaml.parse(indexFileStr)
    } catch {
      console.error(`Unable to process ${MANIFEST_INDEX_FILE_PATH}`);
      process.exit(1)
    }
  }
  return _manifestIndex[template];
}

// Infra: the image context generator

export class ImageContextGenerator {
  replicaMap: Record<string, number>;
  imageContext: Omit<TemplateSharedContext, 'project_name'>;

  constructor(public monorepoEnv: string, public image: string, public gitSha: string) {
    this.replicaMap = getWorkspaceScale(monorepoEnv, image);
    this.imageContext = {
      monorepo_env: monorepoEnv,
      namespace: envToNamespace(monorepoEnv),
      env_secret_name: secretName(),
      env_base_secret_key: BASE_SECRET_KEY,
      domain_name: domainNameForEnv(image, monorepoEnv),
      image_path: containerRegistryRepoPath(image, monorepoEnv, gitSha),
    }
  }

  getDeployment(pkgData: PackageData): TemplateDeploymentObject {
    if (!pkgData.deployment) {
      console.error(`The deployment key is missing for workspace ${pkgData.name}`);
      process.exit(1);
    }
    return {
      // Basic context
      project_name: pkgData.name,
      ...this.imageContext,
      // Defaults that can be overriden by pkgData.deployment
      app_name: pkgData.name,
      subdomain: pkgData.deployment.service_name,
      // This may override the defaults above
      ...pkgData.deployment,
      // Override from config map
      replicas: this.replicaMap[pkgData.name] ?? 1,
    }
  }

  getDbMigrate(): TemplateDbMigrateObject {
    return {
      ...this.imageContext,
      db_migrate_job_name: dbMigrateJobName(this.gitSha),
    }
  }

  getDebug(): TemplateDebugObject {
    return {
      ...this.imageContext,
      debug_pod_name: imageDebugName(this.image)
    }
  }
}

