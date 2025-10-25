import { CLICommandParser, printUsageAndExit, StrongParams } from "../common";
import { establishRedisTunnel, getRedisList } from "../../libs/k8s-redis-ha";

const oneLiner =
  "Utilities to help accessing production and staging redis installation from redis-ha";
const keyExamples = `
    $ devops redis list
    $ devops redis tunnel    redis-staging
`.trim();

const usage = `
${oneLiner}

COMMANDS
    list                                  Lists the available redis installations
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
  tunnel: (opts: StrongParams) => {
    const namespace = opts.required("namespace");
    const port = opts.optional("port") ?? '9379';
    establishRedisTunnel(namespace, port);
  },
};

function run(cmdObj: CLICommandParser) {
  if (cmdObj.help || cmdObj.args.length < 1) printUsageAndExit(usage);
  const parsed = cmdObj.parseOptions({ params: ["-p"] });

  const [command, namespace] = parsed.args;
  const port = parsed.options["-p"];
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

export const redisHa = { name: 'redis-ha', command: 'redis', oneLiner, keyExamples, run };
