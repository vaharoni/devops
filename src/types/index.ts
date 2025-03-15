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
    manifest: string;
    /** For services, this will be the subdomain of the exposed service */
    service_name?: string;
    /** For services, the port to expose */
    port?: number;
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
