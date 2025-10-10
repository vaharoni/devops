import fs from "fs";
import { CLICommandParser, printUsageAndExit } from "./common";

const oneLiner = "Utilities to manage and run DML scripts in the db project";
const keyExamples = `
    $ devops dml create --name my-dml-name
    $ devops dml run 20250113153318_my_dml_name
`;

const usage = `
${oneLiner}

CREATE DML SCRIPTS
    devops dml create --name <dml-semantic-name>

    This command creates a new folder under /dml using the current timestamp and a 
    snake-case version of the name. Inside the folder, a file called migrate.ts is created. 
    You should write your DML script in this file.
    
    You can add additional artifacts to the folder, such as a README.md file, sql files, json 
    files, csv files, etc. You can also add optional scripts, such as rollback.ts.

RUN DML SCRIPTS
    devops dml run <dml-folder-name> [script-file-name] [-- arg1 arg2 ...]

    The dml-folder-name must be the full name, including the timestamp. This follows prisma 
    conventions. 
    If the optional script-file-name is omitted, 'migrate' is used by default. The name should 
    not include the '.ts' suffix. 
    Optionally, args can be passed to the script as command line arguments after double
    dash (--).
    The runner first changes the working directory to 'dml/', then executes the script using 
    'bunx tsx'.
    
    Note: DML scripts are typically run inside the debug container of the image.

EXAMPLES
    ${keyExamples.trim()}
    $ devops dml run 20250113153318_my_dml_name rollback
    $ devops dml run 20250113153318_my_dml_name -- staging
`;

const dmlFileTemplate = `
/**
 * Header code that retrieves the context of the DML script.
 * Feel free to modify this code to suit your needs.
 * 
 * fullDmlFilePath  - path to the current file
 * fullDmlDirPath   - path to the current directory
 * dmlFile          - name of the current DML script file
 * dmlDir           - name of the directory containing the DML scripts
 * args             - command line arguments passed to the script
 * 
 * Notes: 
 * - the script runs with the cwd set to the dml/ directory
 * - remove unused variables from this template, otherwise the linter will complain 
*/

import { prisma } from 'db';
import { basename, dirname, sep } from 'path';
import { fileURLToPath } from 'url';

const fullDmlFilePath = fileURLToPath(import.meta.url);
const fullDmlDirPath = dirname(fullDmlFilePath);
const dmlFile = basename(fullDmlFilePath);
const dmlDir = fullDmlDirPath.split(sep).pop();

const args = process.argv.slice(2);
`.trim();

function createDml(name: string) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14);
  const nameSnake = name.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const folderName = `${timestamp}_${nameSnake}`;
  fs.mkdirSync(`dml/${folderName}`);
  fs.writeFileSync(`dml/${folderName}/migrate.ts`, dmlFileTemplate);
  console.log(`\nCreated DML folder: dml/${folderName}\n`);
}

function runDml(
  cmdObj: CLICommandParser,
  folderName: string,
  scriptFileName?: string,
  args?: string[]
) {
  scriptFileName ??= "migrate";
  args ??= [];
  const script = scriptFileName.endsWith(".ts")
    ? scriptFileName
    : `${scriptFileName}.ts`;
  cmdObj
    .executorFromEnv(
      // prettier-ignore
      `devops exec --in dml bun ${folderName}/${script} ${args.join(" ")}`
    )
    .exec();
}

function run(cmdObj: CLICommandParser) {
  if (cmdObj.help || cmdObj.args.length < 1) printUsageAndExit(usage);
  const parsed = cmdObj.parseOptions({
    passthroughArgs: true,
    params: ["--name"],
  });
  switch (parsed.args[0]) {
    case "create": {
      const name = parsed.options["--name"];
      if (!name) printUsageAndExit(usage);
      return createDml(name);
    }
    case "run": {
      const [_, folderName, scriptFileName] = parsed.args;
      if (!folderName) printUsageAndExit(usage);
      return runDml(cmdObj, folderName, scriptFileName, parsed.passthrough);
    }
    default:
      printUsageAndExit(usage);
  }
}

export default {
  dml: { oneLiner, keyExamples, run },
};
