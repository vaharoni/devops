export type ProjectData = {
  data: PkgData;
  rootPath: string;
};

/** The important part of package.json data */
export type PkgData = {
  /** This is considered the project name */
  name: string;
  /** Scripts exposed by this project. */
  scripts?: Record<string, string>;
  /** The dependencies of the project */
  dependencies?: Record<string, string>;
  /** When a deployment data is available, a k8s deployment is created */
  deployment?: {
    /** The name of the composite template to build in order to support this deployment */
    template: string;
    /** The name used by kubernetes objects. If ommitted, the name field from package.json is used. */
    app_name?: string;
    /** This will be the name of the internal service used for intra-cluster communication */
    service_name?: string;
    /** For services, the port to expose */
    port?: number;
    /** This will be the subdomain of the exposed ingress. If not provided, taken from service_name */
    subdomain?: string;
    /** If a build job is required, the folder the results of the build should be mounted to
     * relative to the project's root */
    cron?: string;
    /** Used by the Jobs infra */
    cronJobs?: {
      /** The name of the cron job. Used to identify in k8s. */
      name?: string;
      /** The cron schedule */
      cron?: string;
      /** The curl command to invoke. Must be an array. */
      curl?: string[];
    }[];
  };
};

// k8s template generation

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

export type TemplateDeploymentObject = TemplateSharedContext & PkgData['deployment'] & {
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