import {
  connectToPatroni,
  connectToPsql,
  establishTunnel,
  getDbAdminPassword,
  getDbBackups,
  getDbList,
  getDbPasswords,
} from "../libs/k8s-db";
import { CLICommandParser, printUsageAndExit, StrongParams } from "./common";

const oneLiner =
  "Utilities to help day to day operations of production and staging databases";
const keyExamples = `
    $ devops db list
    $ devops db backups
    $ devops db password  ui
    $ devops db password  db-staging
    $ devops db tunnel    db-staging
    $ devops db patroni   db-staging
    $ devops db psql      db-staging
`.trim();

const usage = `
${oneLiner}

NOTES
    The admin UI provided by Stackgres is great. It allows you to do most of the operations you need, such as 
    restarting the cluster, upgrading postgres versions, and restoring from backups with point in time recovery (PITR).

    This utility complements the admin UI with a few helpful shortcuts.

    Note that the --env flag should not be used with these commands, as the DB namespaces follow different
    conventions than the monorepo env. 

    This utility assumes that the cluster name and the namespace are always the same.

COMMANDS
    list                                  Lists the available clusters
    backups                               Lists all available backups
    password ui                           Shows the password to the admin UI
    password <namespace>                  Shows the superuser, replication, and authenticator password of the remote database
    patroni  <namespace>                  Obtain a shell to the primary pod's patroni container, where you can run 'patronictl'
    psql     <namespace>                  Runs 'psql' in the primary pod's postgres-utils container
    tunnel   <namespace> [-p <port>]      Sets up a tunnel to the remote database so you can access the DB from your local machine. 
                                          By default, the port is taken from the namespace to make it easier to create connection profiles locally: 
                                          db-staging: 7432, db-production: 8432, otherwise: 9432

EXAMPLES
    ${keyExamples}
`;

const DEFAULT_PORTS = {
  "db-staging": "7432",
  "db-production": "8432",
};

const handlers = {
  list: () => {
    const res = getDbList();
    console.log(res);
  },
  backups: () => {
    const res = getDbBackups();
    console.log(res);
  },
  password: (opts: StrongParams) => {
    const namespace = opts.required("namespace");
    if (namespace === "ui") {
      const res = getDbAdminPassword();
      if (!res) {
        console.error("Failed to get the secret");
        process.exit(1);
      } else {
        console.log(`User: ${res.user}`);
        console.log(`Password: ${res.password}`);
      }
      return;
    }

    const res = getDbPasswords(namespace);
    if (!res) {
      console.error("Failed to get the secret");
      process.exit(1);
    } else {
      console.log("\nSuperuser");
      console.log(`  ${res.superUser}`);
      console.log(`  ${res.superPassword}`);
      console.log("\nAuthenticator");
      console.log(`  ${res.authenticatorUser}`);
      console.log(`  ${res.authenticatorPassword}`);
      console.log("\nReplication");
      console.log(`  ${res.replicationUser}`);
      console.log(`  ${res.replicationPassword}`);
      console.log();
    }
  },
  tunnel: (opts: StrongParams) => {
    // prettier-ignore
    const defaultPort = DEFAULT_PORTS[opts.required("namespace") as keyof typeof DEFAULT_PORTS] || "9432";
    const port = opts.optional("port") || defaultPort;
    establishTunnel(opts.required("namespace"), port);
  },
  patroni: (opts: StrongParams) => {
    connectToPatroni(opts.required("namespace"));
  },
  psql: (opts: StrongParams) => {
    connectToPsql(opts.required("namespace"));
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
  db: { oneLiner, keyExamples, run },
};
