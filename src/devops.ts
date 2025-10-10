#!/usr/bin/env bun
// This file behaves as a façade for various devops scripts
import { CLICommandParser, printUsageAndExit } from "./cli/common";
import affected from "./cli/affected";
import constant from "./cli/constant";
import console from "./cli/console";
import db from "./cli/db";
import dml from "./cli/dml";
import registry from "./cli/registry";
import env from "./cli/env";
import exec from "./cli/exec";
import prepBuild from "./cli/prep-build";
import prisma from "./cli/prisma";
import run from "./cli/run";
import runMany from "./cli/run-many";
import test from "./cli/test";
import init from "./cli/init";
import redis from "./cli/redis";
import internalCurl from "./cli/internal-curl";
import jwt from "./cli/jwt";
import namespace from "./cli/namespace";
import image from "./cli/image";
import template from "./cli/template";
import job from "./cli/job";
import cloudrun from "./cli/cloudrun";

const [_node, _scriptPath, ...commandArgs] = process.argv;

const allImports = [
  // day-to-day
  init,
  run,
  runMany,
  exec,
  env,
  prisma,
  dml,
  db,
  redis,
  console,
  test,
  //= Infra
  namespace,
  image,
  template,
  job,
  //= Deployment
  prepBuild,
  cloudrun,
  affected,
  constant,
  registry,
  internalCurl,
  jwt,
];

const commands: {
  [key: string]: {
    oneLiner: string;
    keyExamples: string;
    run: CallableFunction;
    key: string;
  };
} = {};
allImports.forEach((imported) => {
  Object.entries(imported).forEach(([key, object]) => {
    const { oneLiner, keyExamples, run } = object;
    commands[key] = { oneLiner, keyExamples, run, key };
  });
});

const keyLength = Math.max(...Object.keys(commands).map((x) => x.length)) + 10;
const newLine = "\n    ";

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


COMMANDS
    ${Object.values(commands)
      .map((cmd) =>
        [cmd.key, " ".repeat(keyLength - cmd.key.length), cmd.oneLiner].join("")
      )
      .join(newLine)}
`;

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
const chosenCommand = commands[commandObj.command];
if (!chosenCommand) printUsageAndExit(GENERAL_USAGE);

chosenCommand.run(commandObj);
