import { z } from "zod";

export const SUPPORTED_LANGUAGES = ["python", "node"] as const;
export type SupportedLanguages = typeof SUPPORTED_LANGUAGES[number];

// # Workspace Discovery

// We need a term to describe the files that contain the project data (e.g. package.json, pyproject.toml).
// While they are typically called "manifests" in the context of package managers, we cannot use that term here due to 
// ambiguity with kubernetes manifests. We therefore refer to them as "package files".
//
// Terminology:
// - Workspace             - a project that is part of the monorepo. Can be either a library or an application. We borrow this term from npm workspaces.
// - Package File          - language-specific file that resides inside the workspace's root folder and contains project data (e.g. package.json, pyproject.toml)
// - Package Data          - a language-agnostic abstraction of the relevant data in a package file. Package Files are converted into Package Data.
// - Workspace Index Entry - a record that maps workspace names to where they reside and their package data. A workspace may contain multiple 
//                           package files. In such case, their content must use the same "name" key so that we can always translate paths to names and vice versa.
//                    

// ## Workspace Discovery: Language-agnostic constructs

// The keys are the workspace names
export type WorkspaceIndex = Record<string, WorkspaceIndexEntry>;

export type WorkspaceIndexEntry = {
  rootPath: string;
  packageDataEntries: PackageData[];
};

export type PackageData = Omit<PackageFileNode, 'dependencies'> & {
  // Duplication with WorkspaceIndexEntry intentional to simplify types
  rootPath: string;
  language: SupportedLanguages;
  /** The list of monorepo-internal packages this project depends on */
  dependencyNames: string[];
}

const deploymentSchema = z.object({
  /** The name of the composite template to build in order to support this deployment */
  template: z.string(),
  /** The name used by kubernetes objects. If ommitted, the name field from the enclosing context (e.g. package.json) is used. */
  app_name: z.string().optional(),
  /** This will be the name of the internal service used for intra-cluster communication */
  service_name: z.string().optional(),
  /** For services, the port to expose */
  port: z.number().optional(),
  /** This will be the subdomain of the exposed ingress. If not provided, taken from service_name */
  subdomain: z.string().optional(),
  /** For cron jobs */
  cronJobs: z.array(
    z.object({
      /** The name of the cron job. Used to identify in k8s. Should be unique among all cron jobs. */
      name: z.string().optional(),
      /** The cron schedule */
      cron: z.string().optional(),
      /** The curl command to invoke. Must be an array. */
      curl: z.array(z.string()).optional(),
    })
  ).optional()
});
export type Deployment = z.infer<typeof deploymentSchema>;

// ## Workspace Discovery: Languae-specific constructs

export const packageFileNodeSchema = z.object({
  /** This is considered the project name */
  name: z.string(),
  /** Scripts exposed by this project. */
  scripts: z.record(z.string()).optional(),
  /** The dependencies of the project */
  dependencies: z.record(z.string()).optional(),
  /** When a deployment data is available, a k8s deployment is created */
  deployment: deploymentSchema.optional(),
});
export type PackageFileNode = z.infer<typeof packageFileNodeSchema>;

export const packageFilePythonSchema = z.object({
  project: z.object({
    name: z.string(),
  }),
  tool: z.object({
    poetry: z.object({
      dependencies: z.record(z.any()).optional(),
      scripts: z.record(z.string()).optional(),
    }).optional(),
    devops: z.object({
      deployment: deploymentSchema.optional(),
    }).optional(),
  }).optional(),
})
export type PackageFilePython = z.infer<typeof packageFilePythonSchema>;

// # k8s template generation

// When we generate k8s templates, we need to provide a context object that contains all the necessary information to render the template.
// There are 3 contexts in which we generate templates, and thus 3 types of context objects:
// - Deployment     - used to render the deployable k8s entities a workspace declared in its package file (as part of image deployment)
// - Debug          - used to render a "debug instance" for an image the user can console into (as part of an image deployment)
// - DbMigrateJob   - used to render a job that runs database migrations using one of the images that support it (as part of the orchestrating git-push process)

export type TemplateSharedContext = {
  /** The monorepo environment */
  monorepo_env: string;
  /** The k8s namespace that the monorepo environment is associated with */
  namespace: string;
  /** The domain name associated with the monorepo environment (from constnts.yaml) */
  domain_name: string;
  /** The path to the image in the container registry */
  image_path: string;
  /** The secret name of the monorepo environment */
  env_secret_name: string;
  /** The name of the key inside the environment's secret that contains the base secret (constant) */
  env_base_secret_key: string;
}

export type TemplateDeploymentObject = TemplateSharedContext & Deployment & {
  /** Same as pkgData.name */
  project_name: string;
  /** The number of replicas as defined by running devops scale */
  replicas: number;
}

export type TemplateDbMigrateObject = TemplateSharedContext & {
  /** The name of the migration job to create */
  db_migrate_job_name: string;
}

export type TemplateDebugObject = TemplateSharedContext & {
  /** The name of the debug pod */
  debug_pod_name: string;
}