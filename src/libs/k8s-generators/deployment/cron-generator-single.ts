import { BaseDeploymentGenerator } from "./base-deployment-generator";

export class CronGeneratorSingle extends BaseDeploymentGenerator {
  static method = "manifest" as const;
  static manifest = "cron-job-single.yaml";
  // Required to override like so, otherwise it will inherit from its parent class and override the registry
  static supported = [];

  getVars() {
    return {
      ...super.getVars(),
      MONOREPO_PKG_CRON_SCHEDULE: this.projectData.data.deployment!.cron,
    };
  }
}
