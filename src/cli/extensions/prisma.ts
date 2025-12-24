import { CLICommandParser } from "../common";
import url from "url";
import path from "path";

const __file__ = url.fileURLToPath(import.meta.url);
const __cli__ = path.join(path.dirname(__file__), "../..", "cli");
const execShPath = path.join(__cli__, "exec.sh");

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
    `${execShPath} db bunx prisma ${cmdObj.args.join(" ")}`,
    { checkEnvYaml: false }
  ).spawn()
}

export const prisma = { oneLiner, keyExamples, run };
