import { CLICommandParser } from "../common";

const oneLiner = "Runs prisma commands in the db project after injecting the environment variables";
const keyExamples = `$ devops prisma migrate dev`;

const usage = `
${oneLiner}

GENERAL USAGE
    devops prisma <command>

    <command> can be any command you normally set prisma for.

EXAMPLES
    ${keyExamples}
`;

async function run(cmdObj: CLICommandParser) {
  cmdObj.executorFromEnv(
    `bunx prisma ${cmdObj.args.join(" ")}`,
    { checkEnvYaml: false, cwd: "db" }
  ).spawn()
}

export const prisma = { oneLiner, keyExamples, run };
