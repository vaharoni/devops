import { DbMigrateJobGenerator } from "./k8s-generators/db-migrate-job-generator";
import * as deploymentGenerators from "./k8s-generators/deployment";
import { EnvSetupGenerator } from "./k8s-generators/env-setup-generator";
import { ImageConfigMapGenerator } from "./k8s-generators/image-config-map-generator";
import { getWorkspaceScale } from "./k8s-lifecycle";
import {
  getImageDebugData,
  getImageDescendentData,
} from "./workspace-discovery";

type DeploymentGeneratorClass =
  (typeof deploymentGenerators)[keyof typeof deploymentGenerators];

const generatorLookup: Record<string, DeploymentGeneratorClass> = {};

for (const generatorClass of Object.values(deploymentGenerators)) {
  generatorClass.supported.forEach((supported) => {
    generatorLookup[supported] = generatorClass;
  });
}

export function generateImageDeployments(
  monorepoEnv: string,
  image: string,
  gitSha: string
) {
  const candidatesList = [
    getImageDebugData(image),
    ...getImageDescendentData(image),
  ];
  const scaleCountMap = getWorkspaceScale(monorepoEnv, image);
  const manifest = candidatesList
    .filter((projectData) => projectData.data.deployment)
    .map((projectData) => {
      const template = projectData.data.deployment!.template;
      const generatorClass = generatorLookup[template];
      if (!generatorClass) {
        console.error(`Unsupported template ${template} for project ${projectData.data.name}`);
        process.exit(1);
      }
      const generator = new generatorClass(
        monorepoEnv,
        image,
        gitSha,
        projectData,
        scaleCountMap[projectData.data.name]
      );
      return generator.generate(template);
    })
    .join("\n---\n");

  return { manifest };
}

export function generateEnvSetup(monorepoEnv: string) {
  const generator = new EnvSetupGenerator(monorepoEnv);
  const folder = `env-setup-${generator.monorepoEnv}`;
  let manifest = generator.generate(folder);
  return { manifest };
}

export function generateDbMigrateJob(
  monorepoEnv: string,
  image: string,
  gitSha: string
) {
  const generator = new DbMigrateJobGenerator(monorepoEnv, image, gitSha);
  const manifest = generator.generate();
  return { manifest, jobs: [generator.jobName] };
}

export function generateImageConfigMap(
  monorepoEnv: string,
  image: string,
  data = {}
) {
  const generator = new ImageConfigMapGenerator(monorepoEnv, image, data);
  const manifest = generator.generate();
  return { manifest };
}
