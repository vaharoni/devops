export { CommandExecutor, CLICommandParser, printUsageAndExit, StrongParams } from "./cli/common";
export { kubectlCommand } from "./libs/k8s-helpers";

import path from "path";
import { pkgRoot } from "./pkg-root";
/** @deprecated Pass the `cwd` option to CommandExecutor instead */
export const execShPath = path.join(pkgRoot, "cli/exec.sh");