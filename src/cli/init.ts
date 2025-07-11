import url from "url";
import path from "path";
import fs from "fs-extra";

const __file__ = url.fileURLToPath(import.meta.url);
const __root__ = path.join(path.dirname(__file__), "../..");
const templatesDir = path.join(__root__, "src/target-templates");
const targetDir = process.cwd(); // User's current working directory

import { CLICommandParser, printUsageAndExit } from "./common";

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
  copyTemplates();
}

export default {
  init: { oneLiner, keyExamples, run },
};

async function copyTemplates() {
  console.log(`Initializing devops files from ${templatesDir} to ${targetDir}`);

  try {
    // Copy files without overriding existing ones
    await fs.copy(templatesDir, targetDir, {
      overwrite: false,
      errorOnExist: false,
      dereference: false,
    });

    console.log(successMessage);
  } catch (error) {
    console.error("❌ Failed to initialize devops files:", error);
    process.exit(1);
  }
}

const successMessage = `
✅ Devops files initialized successfully!

To finish the setup: 

1. add the following entry to the main package.json:
  "workspaces": [
    "libs/**",
    "applications/**",
    "db/**",
    "dml/**"
  ],

2. add the following to your .gitignore:
**/.env*
config/kubeconfig
tmp/**
!tmp/**/.gitkeep
venv/
**/__pycache__

3. optionally create an .envrc file with the following content and run direnv allow: 
if [ -f "$PWD/config/kubeconfig" ]; then
  export KUBECONFIG="$PWD/config/kubeconfig"
else
  export KUBECONFIG="$HOME/.kube/config"
fi
`;
