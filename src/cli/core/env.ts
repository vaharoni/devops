import {
  deleteMonorepoSecret,
  getMonorepoSecretStr,
  setMonorepoSecret,
} from "../../libs/k8s-secrets-manager";
import { loadDotEnvFiles } from "../../libs/dotenv";
import {
  CLICommandParser,
  dotEnvFilesForEnv,
  printUsageAndExit,
  validateEnvYamlFiles,
} from "../common";

const oneLiner = "Commands to manipulate env variables";
const keyExamples = `
$ devops env get --env staging
$ devops env get KEY1 KEY2 --env staging
$ devops env set KEY1=123 KEY2=345 --env staging
$ devops env delete KEY1 KEY2 --env staging
$ devops env validate
`;

const usage = `
${oneLiner}

COMMANDS
  get         Fetches secrets for the chosen environment and printes them to console
  set         Sets specific secrets for the chosen environment
  delete      Deletes specific secrets for the chosen environment
  validate    Validate locally, verifying the existence and type of environment variables against all env.yaml files

EXAMPLES
  ${keyExamples}
`;

function run(cmdObj: CLICommandParser) {
  if (cmdObj.help || cmdObj.args.length === 0) printUsageAndExit(usage);
  const [command, ...rest] = cmdObj.args;
  switch (command) {
    case "validate": {
      // Same variables as commands run through the executor, which always set MONOREPO_ENV and MONOREPO_ROOT
      const env = {
        ...loadDotEnvFiles(dotEnvFilesForEnv(cmdObj.env)),
        ...process.env,
        MONOREPO_ENV: cmdObj.env,
        MONOREPO_ROOT: process.cwd(),
      };
      validateEnvYamlFiles(cmdObj.env, { env });
      break;
    }

    case "get": {
      console.log(getMonorepoSecretStr(cmdObj.env, rest));
      break;
    }

    case "set": {
      setMonorepoSecret(cmdObj.env, rest);
      break;
    }

    case "delete": {
      deleteMonorepoSecret(cmdObj.env, rest);
      break;
    }

    default: {
      printUsageAndExit(usage);
    }
  }
}

export const env = { oneLiner, keyExamples, run };
