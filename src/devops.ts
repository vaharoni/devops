#!/usr/bin/env bun
// This file behaves as a façade for various devops scripts
import { globSync } from "glob";
import { CLICommandParser, printUsageAndExit } from "./cli/common";
import * as coreImports from "./cli/core";
import * as extensionImports from "./cli/extensions";
import { getConst } from "./libs/config";
import { existsSync, readdirSync } from "fs";
import path from "path";

const [_node, _scriptPath, ...commandArgs] = process.argv;

// Types
type CommandMap = {
  [key: string]: {
    oneLiner: string;
    keyExamples: string;
    run: CallableFunction;
    key: string;
  };
}

// Presentation
const newLine = "\n    ";
function maxKeyLength(commands: CommandMap) {
  return Math.max(...Object.keys(commands).map((x) => x.length)) + 10;
}

// Core commands
const coreCommands: CommandMap = {};
Object.entries(coreImports).forEach(([constKey, imported]) => {
  const { oneLiner, keyExamples, run } = imported;
  const key = 'command' in imported ? imported.command : constKey;
  coreCommands[key] = { oneLiner, keyExamples, run, key };
});
const coreCommandsKeyLength = maxKeyLength(coreCommands);

// Extensions
const extensionCommands: CommandMap = {};
const activeExtensions = getConst('extensions', { ignoreIfInvalid: true });
if (activeExtensions?.length) {
  const availableExtensionsLookup = Object.fromEntries(
    Object.entries(extensionImports).map(([constKey, value]) => {
      const { oneLiner, keyExamples, run } = value;
      const keyInYaml = 'name' in value ? value.name : constKey;
      const key = 'command' in value ? value.command : constKey;
      return [keyInYaml, { oneLiner, keyExamples, run, key }];
    })
  );
  for (const extension of activeExtensions) {
    const extensionData = availableExtensionsLookup[extension];
    if (!extensionData) { 
      console.error(`\nExtension "${extension}" referenced in constants.yaml is not supported\n\n`);
      process.exit(1);
    }
    extensionCommands[extensionData.key] = extensionData;
  }
}
const extensionCommandsKeyLength = maxKeyLength(extensionCommands);

// Plugins
const pluginCommands: CommandMap = {};
if (existsSync('.devops/plugins')) {
  const pluginsDir = path.join(process.cwd(), '.devops/plugins');
  const pluginFiles = globSync(path.join(pluginsDir, '*.ts'));
  for (const pluginFile of pluginFiles) {
    const plugin = await import(pluginFile);
    const keys = Object.keys(plugin);
    if (keys.length !== 1) {
      console.error(`Plugin ${pluginFile} must export exactly one command`);
      process.exit(1);
    }
    const constKey = keys[0];
    const { oneLiner, keyExamples, run, command } = plugin[constKey];
    const key = command ?? constKey;
    if (!oneLiner || !keyExamples || !run) {
      console.error(`Plugin ${pluginFile} must export oneLiner, keyExamples, and run`);
      process.exit(1);
    }
    if (typeof run !== 'function') {
      console.error(`Plugin ${pluginFile} must export a run function`);
      process.exit(1);
    }
    pluginCommands[key] = { oneLiner, keyExamples, run, key };
  }
}
const pluginCommandsKeyLength = maxKeyLength(pluginCommands);

const GENERAL_USAGE = `
Devops utilities for the monorepo.

USAGE
    devops <command> <args> <env-options>

CHOOSING ENV with <env-options>
    By default, all commands run under the env specified in MONOREPO_ENV env variable, or development if it does not exist.
    The test command is an exception: its environment is forced to test. 
    When running in development, the env files config/.env.development and config/.env.global are injected, where the 
    former overrides the latter.

    To override the environment in which a command is executed in, use --env <some-env>. This overrides the MONOREPO_ENV variable.
    You can use it anywhere in the command, i.e. the following are equivalent:
    $ devops --env staging run project:task
    $ devops run project:task --env staging

    Supported environments: development, staging, test, and production.

    Certain commands like run, exec, and prisma ensure that the env variables exist and correspond to env.yaml files in the repo. 
    To skip this check, use --skip-env-check.


CORE COMMANDS
    ${Object.values(coreCommands)
      .map((cmd) =>
        [cmd.key, " ".repeat(coreCommandsKeyLength - cmd.key.length), cmd.oneLiner].join("")
      )
      .join(newLine)}
`;

const EXTENSION_USAGE = Object.keys(extensionCommands).length ? `
ACTIVE EXTENSIONS
    ${Object.values(extensionCommands)
      .map((cmd) =>
        [cmd.key, " ".repeat(extensionCommandsKeyLength - cmd.key.length), cmd.oneLiner].join("")
      )
      .join(newLine)}
` : '';

const PLUGIN_USAGE = Object.keys(pluginCommands).length ? `
ACTIVE PLUGINS
    ${Object.values(pluginCommands)
      .map((cmd) =>
        [cmd.key, " ".repeat(pluginCommandsKeyLength - cmd.key.length), cmd.oneLiner].join("")
      )
      .join(newLine)}
` : '';

const ALL_USAGE = [GENERAL_USAGE, EXTENSION_USAGE, PLUGIN_USAGE].filter(Boolean).join("");

const allCommands = { ...coreCommands, ...extensionCommands, ...pluginCommands };

// EXAMPLES
//     ${Object.values(commands)
//       .map((cmd) =>
//         cmd.keyExamples
//           .split("\n")
//           .map((x) => x.trim())
//           .filter(Boolean)
//           .join(newLine)
//       )
//       .join(newLine)}

const commandObj = new CLICommandParser(commandArgs,);
const chosenCommand = allCommands[commandObj.command];
if (!chosenCommand) printUsageAndExit(ALL_USAGE);

chosenCommand.run(commandObj);
