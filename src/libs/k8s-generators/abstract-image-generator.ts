import { AbstractGenerator } from "./abstract-generator";
import { containerRegistryRepoPath } from "./k8s-constants";

export class AbstractImageGenerator extends AbstractGenerator {
  constructor(
    monorepoEnv: string,
    public image: string,
    public gitSha: string
  ) {
    super(monorepoEnv);
    if (!image) throw new Error("image must be present");
    if (!gitSha) throw new Error("gitSha must be present");
  }

  getVars() {
    return {
      ...super.getVars(),
      MONOREPO_IMAGE_PATH: containerRegistryRepoPath(
        this.image,
        this.monorepoEnv,
        this.gitSha
      ),
    };
  }
}
