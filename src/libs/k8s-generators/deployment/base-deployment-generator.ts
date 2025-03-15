import { type ProjectData } from "../../../types";
import { AbstractImageGenerator } from "../abstract-image-generator";
import { domainNameForEnv, imageDebugName } from "../k8s-constants";

export class BaseDeploymentGenerator extends AbstractImageGenerator {
  static method = "composite" as "composite" | "manifest";
  static supported: string[] = [
    "backend-process",
    "internal-service",
    "external-service",
    "debug-console",
  ];

  constructor(
    monorepoEnv: string,
    image: string,
    gitSha: string,
    public projectData: ProjectData,
    public replicaCount?: number
  ) {
    super(monorepoEnv, image, gitSha);
    if (!projectData.data.deployment) {
      throw new Error("Deployment data is missing");
    }
  }

  getVars() {
    return {
      ...super.getVars(),
      MONOREPO_SERVICE_NAME: this.projectData.data.deployment?.service_name,
      MONOREPO_PROJECT_NAME: this.projectData.data.name,
      MONOREPO_DEBUG_NAME: imageDebugName(this.image),
      // TODO: change this to be taken from Redis so that the latest is maintained
      MONOREPO_PKG_REPLICAS: this.replicaCount ?? 1,
      MONOREPO_PKG_PORT: this.projectData.data.deployment?.port,
      MONOREPO_DOMAIN_NAME: domainNameForEnv(this.monorepoEnv),
      // If at some point we allow ad-hoc environments, this could be different
      MONOREPO_PKG_SUBDOMAIN: this.projectData.data.deployment?.service_name,
    };
  }
}
