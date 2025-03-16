import yaml from "yaml";
import { type ProjectData } from "../../../types";
import { BaseDeploymentGenerator } from "./base-deployment-generator";
import { CronGeneratorSingle } from "./cron-generator-single";

export class CronGeneratorMany extends BaseDeploymentGenerator {
  static supported = ["cron-job"];

  generate(_folder?: string) {
    const jobs = this.projectData.data.deployment?.cronJobs;
    if (!jobs?.length) {
      throw new Error(
        `No cron jobs defined in package ${this.projectData.data.name}`
      );
    }
    return jobs
      .map((job) => {
        const name = `${this.projectData.data.name}-${job.name}`;
        const projectData: ProjectData = {
          rootPath: this.projectData.rootPath,
          data: {
            name,
            deployment: {
              template: "cron-job-single",
              service_name: name,
              cron: job.cron,
            },
          },
        };
        const manifest = new CronGeneratorSingle(
          this.monorepoEnv,
          this.image,
          this.gitSha,
          projectData
        ).generate("cron-job");
        const jsonData = yaml.parse(manifest);
        const currArgs = jsonData.spec.jobTemplate.spec.template.spec.containers[0].args;
        jsonData.spec.jobTemplate.spec.template.spec.containers[0].args = currArgs.concat(job.curl);
        return yaml.stringify(jsonData);
      })
      .join("\n---\n");
  }
}
