import chalk from "chalk";
import { establishRedisTunnel, getRedisList, getRedisPassword } from "../libs/k8s-redis";
import { CLICommandParser, printUsageAndExit, StrongParams } from "./common";

const oneLiner =
  "Utilities to help accessing production and staging redis";
const keyExamples = `
    $ devops redis list
    $ devops redis password  redis-staging
    $ devops redis tunnel    redis-staging
`.trim();

const usage = `
${oneLiner}

COMMANDS
    list                                  Lists the available redis installations
    password <namespace>                  Shows the password for the Redis instance
    tunnel   <namespace> [-p <port>]      Sets up a tunnel to the remote Redis instance so you can access the DB from your local machine on port 9379 by default

NOTES
    This command assumes the namespace and the helm release name are the same.
    The --env flag should not be used with these commands, as the Redis namespaces follow different conventions than the monorepo env. 

EXAMPLES
    ${keyExamples}
`;

const handlers = {
  list: () => {
    const res = getRedisList();
    console.log(res);
  },
  password: (opts: StrongParams) => {
    const namespace = opts.required("namespace");
    const res = getRedisPassword(namespace);
    if (!res) {
      console.error("Failed to get the secret");
      process.exit(1);
    } else {
      console.log();
      console.log(res.password);
      console.log();
    }
  },
  tunnel: (opts: StrongParams) => {
    const namespace = opts.required("namespace");
    const port = opts.optional("port") ?? '9379';
    const res = getRedisPassword(namespace);
    console.log(
      chalk.blue('\nAfter the tunnel is established, connect to Redis by running:\n\t') + 
      chalk.green.bold(`redis-cli -p ${port} --askpass`)
    );
    if (res) {
      console.log(chalk.blue('\tPassword: ') + chalk.green.bold(res.password))
      console.log();
    } 
    establishRedisTunnel(namespace, port);
  },
};

function run(cmdObj: CLICommandParser) {
  if (cmdObj.help || cmdObj.args.length < 1) printUsageAndExit(usage);
  const parsed = cmdObj.parseOptions({ params: ["-p"] });

  const [command, namespace] = parsed.args;
  const port = parsed.options["-p"] as string;
  // @ts-expect-error left as an exercise for the reader
  const handler = handlers[command];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    printUsageAndExit(usage);
  }
  const params = new StrongParams(usage, {
    namespace,
    port,
  });
  handler(params);
}

export default {
  redis: { oneLiner, keyExamples, run },
};
