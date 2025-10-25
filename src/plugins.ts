export { CommandExecutor, CLICommandParser, printUsageAndExit, StrongParams } from "./cli/common";
export { kubectlCommand } from "./libs/k8s-helpers";

import url from "url";
import path from "path";
const __file__ = url.fileURLToPath(import.meta.url);
const __cli__ = path.join(path.dirname(__file__), "cli");
export const execShPath = path.join(__cli__, "exec.sh");