import inquirer from "inquirer";
import { InitGenerator, type InitGeneratorFileInfo } from "../../libs/init-generator";
import { CLICommandParser, printUsageAndExit } from "../common";
import chalk from "chalk";
import fs from 'fs-extra';
import type { ConstFileSchema } from "../../types";

const oneLiner =
  "Initializes the devops utility by copying template files to the current folder";
const keyExamples = `$ devops init`;

const usage = `
${oneLiner}

NOTE
    No files are overwritten.

EXAMPLES
    ${keyExamples}
`;

async function run(cmdObj: CLICommandParser) {
  if (cmdObj.help) printUsageAndExit(usage);
  createFiles();
}

export const init = { oneLiner, keyExamples, run };

async function createFiles() {
  const tc = new InitGenerator();
  const userChoices = await getUserChoices(tc.projectName);

  // Language variants
  tc.addCopiedFolder("lang-variants-common/typescript", ".");
  if (userChoices.usePython) {
    tc.addCopiedFolder("lang-variants-common/python", ".");
    tc.enableSubtitution("pyproject.toml");
  }
  tc.enableSubtitution(".devops/config/images.yaml");
  tc.setMessageGenerator(".envrc", envrcMessage);

  // gitignore
  const gitIgnore = gitIgnoreContent(userChoices.infraVariant, userChoices.usePython)
  tc.addGeneratedFile(".gitignore", gitIgnore);
  tc.setMessageGenerator(".gitignore", gitignoreMessageGen(gitIgnore));

  // Infra variants
  tc.addCopiedFolder(`infra-variants/${userChoices.infraVariant}`, ".");
  tc.enableSubtitution(".devops/config/constants.yaml");
  if (userChoices.infraVariant === "hetzner") {
    tc.enableSubtitution(".devops/infra/hetzner/harbor-cert.yaml");
    tc.enableSubtitution(".devops/infra/hetzner/harbor-values.yaml");
    tc.enableSubtitution(".devops/infra/hetzner/hcloud-config.yaml");
  }

  // Prisma
  if (userChoices.usePrisma) {
    tc.addCopiedFolder("lang-variants-prisma/typescript", ".");
    if (userChoices.usePython) {
      tc.addCopiedFolder("lang-variants-prisma/python", ".");
    }
  }

  // Cluster resources
  const clusterResources = new Set(userChoices.clusterResources);
  if (clusterResources.has("dns-test")) {
    tc.addCopiedFolder("cluster-resource-options/dns-test", ".devops/infra/dns-test");
  }
  if (clusterResources.has("monitoring-ingress")) {
    tc.addCopiedFolder("cluster-resource-options/monitoring-ingress", ".devops/infra/monitoring-ingress");
  }
  if (clusterResources.has("postgres")) {
    tc.addCopiedFolder("cluster-resource-options/postgres", ".devops/infra/postgres");
    // prettier-ignore
    tc.enableSubtitution(".devops/infra/postgres/staging/configurations/07-SGObjectStorage.yaml");
    // prettier-ignore
    tc.enableSubtitution(".devops/infra/postgres/staging/configurations/08-SGScript.yaml");
    // prettier-ignore
    tc.enableSubtitution(".devops/infra/postgres/production/configurations/07-SGObjectStorage.yaml");
    // prettier-ignore
    tc.enableSubtitution(".devops/infra/postgres/production/configurations/08-SGScript.yaml");
  }
  if (clusterResources.has("redis")) {
    tc.addCopiedFolder("cluster-resource-options/redis", ".devops/infra/redis");
  }
  if (clusterResources.has("milvus")) {
    tc.addCopiedFolder("cluster-resource-options/milvus", ".devops/infra/milvus");
  }
  if (clusterResources.has("prefect") && userChoices.usePython) {
    tc.addCopiedFolder("cluster-resource-options/prefect", ".devops/infra/prefect");
  }

  tc.run({
    substitution: {
      'PROJECT_NAME': userChoices.projectName,
      'STAGING_DOMAIN': userChoices.stagingDomain,
      'PRODUCTION_DOMAIN': userChoices.productionDomain,
      'GCLOUD_PROJECT_ID': userChoices.gcloudProjectId,
      'REGISTRY_IMAGE_PATH_PREFIX': userChoices.registryImagePathPrefix,
      'REGISTRY_BASE_URL': userChoices.registryBaseUrl,
    },
    messages: [
      packageJsonMessage(userChoices.usePrisma)
    ]
  })
}

function packageJsonMessage(usePrisma: boolean) {
  const prismaMessage = usePrisma 
    ? `,
    "db/**",
    "dml/**"` 
    : "";

  return `add the following entry to the main ${chalk.blue("package.json")}:
  ${chalk.yellow(`"workspaces": [
    "libs/**",
    "applications/**"${prismaMessage}
  ],`)}`
}

function gitIgnoreContent(infraVariant: UserChoices["infraVariant"], usePython: boolean) {
  const common = `**/.env*
config/kubeconfig
tmp/**
!tmp/**/.gitkeep`;

  const gcloud = infraVariant === 'gcloud' 
    ? 'config/gke_gcloud_auth_plugin_cache'
    : null;

  const python = usePython
    ? `venv/
**/__pycache__`
    : null;

  return [common, gcloud, python].filter(Boolean).join('\n');
}

function gitignoreMessageGen(content: string) {
  return (exists: boolean) => {
    if (!exists) return;
    return `add the following to your ${chalk.blue(".gitignore")}:
${chalk.yellow(content)}`;   
  }
}

function envrcMessage(targetExists: boolean, fileInfo: InitGeneratorFileInfo) {
  if (fileInfo.type !== 'copied') throw new Error(`envrcMessage() expects a copied file, got ${fileInfo.type}`);
  if (targetExists) {
    const content = fs.readFileSync(fileInfo.sourceAbs, 'utf-8');
    return `add the following to your ${chalk.blue(".envrc")} and run ${chalk.yellow("direnv allow")}:
${chalk.yellow(content)}`;
  } else {
    return `Enable ${chalk.blue(".envrc")} by installing ${chalk.blue('direnv')} and running ${chalk.yellow("direnv allow")}`;
  }
}

type UserChoices = {
  projectName: string;
  stagingDomain: string;
  productionDomain: string;
  infraVariant: ConstFileSchema["infra"];
  gcloudProjectId?: string;
  registryImagePathPrefix?: string;
  registryBaseUrl?: string;
  usePython: boolean;
  usePrisma: boolean;
  clusterResources: string[];
};

function getUserChoices(projectName: string | undefined): Promise<UserChoices> {
  const defaultProjectName = projectName || "changeme";

  return inquirer.prompt([
    {
      type: "input",
      name: "projectName",
      message: `Enter the project name (default: '${defaultProjectName}')`,
      default: defaultProjectName,
    },
    {
      type: "input",
      name: "stagingDomain",
      message: "Enter the staging domain (default: 'staging.com')",
      default: "staging.com",
    },
    {
      type: "input",
      name: "productionDomain",
      message: "Enter the production domain (default: 'production.com')",
      default: "production.com",
    },
    {
      type: "list",
      name: "infraVariant",
      message: "Where does your cluster run?",
      choices: [
        { name: "Google Cloud", value: "gcloud" },
        { name: "Digital Ocean", value: "digitalocean" },
        { name: "Hetzner", value: "hetzner" },
      ],
    },
    {
      type: "input",
      name: "gcloudProjectId",
      message: "Enter the GCP project ID (default: 'changeme')",
      default: "changeme",
      when: (answers) => answers.infraVariant === "gcloud",
    },
    {
      type: "input",
      name: "registryImagePathPrefix",
      message: (answers) => `Enter your Digital Ocean container registry name (default: '${answers.projectName}')`,
      default: (answers) => answers.projectName,
      when: (answers) => answers.infraVariant === "digitalocean",
    },
    {
      type: "input",
      name: "registryBaseUrl",
      message: (answers) => `Enter your registry base URL (default: 'registry.${answers.stagingDomain}')`,
      default: (answers) => `registry.${answers.stagingDomain}`,
      when: (answers) => answers.infraVariant === "hetzner",
    },
    {
      type: "confirm",
      name: "usePython",
      message: "Add support for Python?",
      default: true,
    },
    {
      type: "confirm",
      name: "usePrisma",
      message: "Add support for Prisma?",
      default: true,
    },
    {
      type: "checkbox",
      name: "clusterResources",
      message: "Optional manifests and helm charts to add",
      choices: (answers) => [
        { name: "Manifest to test DNS setup", value: "dns-test" },
        { name: "Manifest to setup ingress for graphana and prometheus", value: "monitoring-ingress" },
        { name: "Stackgres CRDs and manifests for Postgres", value: "postgres" },
        { name: "Redis Helm chart values", value: "redis" },
        { name: "Milvus helm chart values", value: "milvus" },
        ...(answers.usePython ? [{ name: "Prefect Helm chart values", value: "prefect" }] : [])
      ]
    }
  ])
}
