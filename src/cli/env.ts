import fs from "fs";
import { globSync } from "glob";
import {
  deleteMonorepoSecret,
  getMonorepoSecret,
  setMonorepoSecret,
} from "../libs/k8s-secrets-manager";
import { CombinedEnvValidator } from "../libs/validate-env";
import {
  CLICommandParser,
  dotEnvFilesForEnv,
  printUsageAndExit,
} from "./common";
import { getDecendentData } from "../libs/workspace-discovery";

const oneLiner = "Commands to manipulate env variables";
const keyExamples = `
$ devops env get --env staging
$ devops env get KEY1 KEY2 --env staging
$ devops env set KEY1=123 KEY2=345 --env staging
$ devops env delete KEY1 KEY2 --env staging
$ devops env validate
$ devops env validate myproject
`;

const usage = `
${oneLiner}

COMMANDS
  get         Fetches secrets for the chosen environment and printes them to console
  set         Sets specific secrets for the chosen environment
  delete      Deletes specific secrets for the chosen environment
  validate    Validate locally

SPECIAL validate USAGE
    If a project is not provided, verifies the existence and type of environment variables against all env.yaml files.
    Warnings for superfluous variables are printed.

    If a project is provided, verifies the existence and type of the env.yaml files of that specific project and 
    its dependencies. Warnings for superfluous variables are not printed, as it is likely many of the variables
    are necessary for other projects.

EXAMPLES
  ${keyExamples}
`;

function envYamlForProject(project: string) {
  const envYamlFiles: string[] = [];
  getDecendentData(project).forEach((node) => {
    const fileName = `${node.rootPath}/env.yaml`;
    if (fs.existsSync(fileName)) {
      envYamlFiles.push(fileName);
    }
  });
  return envYamlFiles;
}

function allEnvYamlFiles() {
  return globSync("**/env.yaml");
}

function run(cmdObj: CLICommandParser) {
  if (cmdObj.help || cmdObj.args.length === 0) printUsageAndExit(usage);
  const [command, ...rest] = cmdObj.args;
  switch (command) {
    case "validate": {
      const project = rest[0];
      const envYamlFiles = project
        ? envYamlForProject(project)
        : allEnvYamlFiles();

      // We have to have a _validate so that we go through a CommandExecutor which injects env variables into the process
      cmdObj
        .executorFromEnv(
          `devops env _validate ${
            project ? "--skip-dotenv" : ""
          } ${envYamlFiles.join(" ")}`,
          { quiet: false }
        )
        .exec();
      break;
    }

    case "_validate": {
      const options = cmdObj.parseOptions({ booleans: ["--skip-dotenv"] });
      const [_subcmd, ...envYamlFiles] = options.args;
      const envFiles = options.options["--skip-dotenv"]
        ? []
        : dotEnvFilesForEnv(cmdObj.env);
      const validator = new CombinedEnvValidator(envYamlFiles, envFiles);
      validator.validate();
      break;
    }

    case "get": {
      console.log(getMonorepoSecret(cmdObj.env, rest));
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

export default {
  env: { oneLiner, keyExamples, run },
};
