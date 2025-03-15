import { AbstractGenerator } from "./abstract-generator";
import { imageConfigMap } from "./k8s-constants";

// Derives from AbstractGenerator since it does not require the gitSha, unlike AbstractImageGenerator
export class ImageConfigMapGenerator extends AbstractGenerator {
  static method = "manifest" as const;
  static manifest = "image-config-map.yaml";

  constructor(monorepoEnv: string, public image: string, public data = {}) {
    super(monorepoEnv);
    if (!image) throw new Error("image must be present");
    if (!data) throw new Error("data must be present");
  }

  getVars() {
    return {
      ...super.getVars(),
      MONOREPO_IMAGE_CONFIG_MAP: imageConfigMap(this.image),
      MONOREPO_JSON_DATA: JSON.stringify(this.data),
    };
  }
}
