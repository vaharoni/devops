import { AbstractGenerator } from "./abstract-generator";
import { domainNameForEnv } from "./k8s-constants";

export class EnvSetupGenerator extends AbstractGenerator {
  static method = "composite" as const;
  static supported = ["env-setup-production", "env-setup-staging"];

  getVars() {
    return {
      ...super.getVars(),
      MONOREPO_DOMAIN_NAME: domainNameForEnv(this.monorepoEnv),
    };
  }
}
