import { AbstractImageGenerator } from "./abstract-image-generator";
import { dbMigrateJobName } from "./k8s-constants";

export class DbMigrateJobGenerator extends AbstractImageGenerator {
  static method = "manifest" as const;
  static manifest = "db-migrate-job.yaml";

  jobName: string;

  constructor(monorepoEnv: string, image: string, gitSha: string) {
    super(monorepoEnv, image, gitSha);
    this.jobName = dbMigrateJobName(gitSha);
  }

  getVars() {
    return {
      ...super.getVars(),
      MONOREPO_DB_MIGRATE_JOB_NAME: this.jobName,
    };
  }
}
