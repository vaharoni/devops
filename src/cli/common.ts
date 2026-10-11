import chalk from "chalk";
import { execSync, spawn, type StdioOptions } from "child_process";
import fs from "fs";
import { allSupportedEnvs } from "../libs/k8s-constants";
import { globEnvYamlFiles } from "../libs/discovery";
import { loadDotEnvFiles } from "../libs/dotenv";
import { ALWAYS_INJECTED_PREFIX, envRequirementsFromFiles, scopeEnvToWorkspace, workspaceEnvYamlFiles } from "../libs/env-scope";
import { CombinedEnvValidator } from "../libs/validate-env";
import { assertImageExists, availableImagesMessage } from "../libs/config";

type ParsedArgs<TBoolKeys extends readonly string[], TParamKeys extends readonly string[]> = {
  args: string[];
  argsStr: string;
  options: Partial<Record<TBoolKeys[number], true>> & Partial<Record<TParamKeys[number], string>>;
  passthrough?: string[];
};

interface ExecSyncError extends Error {
  status?: number; // Exit code of the subprocess
  stdout?: Buffer; // Standard output
  stderr?: Buffer; // Standard error
}

export class CLICommandParser {
  command: string;
  args: string[];
  env: string;
  envForced: boolean;
  help: boolean;
  skipEnvCheck: boolean;

  constructor(cmdArray: string[]) {
    const parsedArgs = this._separateOptions(cmdArray.filter(Boolean), {
      params: ["--env"] as const,
      booleans: ["--help", "--skip-env-check"] as const,
    });
    const [command, ...args] = parsedArgs.args;
    this.command = command;
    this.args = args;
    this.envForced = Boolean(parsedArgs.options["--env"]);
    this.env =
      (parsedArgs.options["--env"] as string) ??
      process.env["MONOREPO_ENV"] ??
      "development";
    this.help = Boolean(parsedArgs.options["--help"]);
    this.skipEnvCheck = Boolean(parsedArgs.options["--skip-env-check"]);
    // We need to hardcode this to avoid chicken-and-egg problem (validate env depends on constants.yaml existence)
    if (this.command !== 'init') {
      this._validateEnv(this.env);
    }
  }

  // Copies the env
  executorFromEnv(
    commandStr: string,
    options: Omit<CommandExecutorOptions, "env"> = {}
  ): CommandExecutor {
    const checkEnvYamlOverride = this.skipEnvCheck
      ? { checkEnvYaml: false }
      : {};
    return new CommandExecutor(commandStr, {
      env: this.env,
      ...options,
      ...checkEnvYamlOverride,
    });
  }

  // Example:
  //    const cmd = new CLICommandParser('devops run --some-flag --in workspace arg1'.split(' '));
  //    cmd.parseOptions({ boolean: ['--some-flag'], params: ['--in'] })
  //    # => { args: ['arg1'], options: { '--some-flag': true, '--in': 'workspace' } }
  //
  // Note that the global param --env is already extracted and can be accessed with cmd.env
  parseOptions<const TBoolKeys extends readonly string[], const TParamKeys extends readonly string[]>({
    params,
    booleans,
    passthroughArgs = false,
  }: {
    /** Param is used like so: --param value */
    params?: TParamKeys
    /** Boolean flag is used like so: --flag */
    booleans?: TBoolKeys;
    /** Pass through args are used like so: -- arg1 arg2 */
    passthroughArgs?: boolean;
  } = {}): ParsedArgs<TBoolKeys, TParamKeys> {
    return this._separateOptions(this.args, {
      params,
      booleans,
      passthroughArgs,
    });
  }

  _validateEnv(env: string) {
    if (!allSupportedEnvs().includes(env)) {
      console.error(
        // prettier-ignore
        `Environment must be one of: ${allSupportedEnvs().join(", ")}. Received: ${env}`
      );
      process.exit(1);
    }
    return true;
  }

  _separateOptions<const TBoolKeys extends readonly string[], const TParamKeys extends readonly string[]>(
    args: string[],
    {
      params,
      booleans,
      passthroughArgs = false,
    }: {
      params?: TParamKeys;
      booleans?: TBoolKeys;
      passthroughArgs?: boolean;
    } = {}
  ): ParsedArgs<TBoolKeys, TParamKeys> {
    const paramsLookup = new Set<TParamKeys[number]>(params ?? []);
    const booleansLookup = new Set<TBoolKeys[number]>(booleans ?? []);
    const isParam = (arg: string): arg is TParamKeys[number] => paramsLookup.has(arg);
    const isBoolean = (arg: string): arg is TBoolKeys[number] => booleansLookup.has(arg);

    const passthroughArgsStart = passthroughArgs ? args.indexOf("--") : -1;
    // prettier-ignore
    const numArgsToProcess = passthroughArgsStart === -1 ? args.length : passthroughArgsStart;

    const getResPassthrough = () => {
      if (!passthroughArgs || passthroughArgsStart < 0) return { passthrough: []};
      return { passthrough: args.slice(passthroughArgsStart + 1) };
    }

    const resArgs: string[] = [];
    const resParams: Partial<Record<TParamKeys[number], string>> = {};
    const resOptions: Partial<Record<TBoolKeys[number], true>> = {};

    for (let i = 0; i < numArgsToProcess; ++i) {
      const curr = args[i];
      if (isParam(curr)) {
        const next = args[i + 1];
        resParams[curr] = next;
        ++i;
      } else if (isBoolean(curr)) {
        resOptions[curr] = true;
      } else {
        resArgs.push(curr);
      }
    }
    return {
      args: resArgs,
      argsStr: resArgs.join(" "),
      options: { ...resOptions, ...resParams },
      ...getResPassthrough(),
    };
  }
}

type CommandExecutorOptions = {
  env?: string;
  quiet?: boolean;
  checkEnvYaml?: boolean;
  redactedCommand?: string;
  /**
   * A workspace name. When set, only the env file variables declared in the env.yaml files of the workspace and its
   * dependencies are injected, and only those env.yaml files are validated. When omitted, all variables are injected.
   */
  envScope?: string;
  /** The directory to run the command in, relative to the monorepo root */
  cwd?: string;
};
export class CommandExecutor {
  commandStr: string;
  env?: string;
  quiet: boolean;
  redactedCommand?: string;
  checkEnvYaml: boolean;
  envScope?: string;
  cwd?: string;
  _fileEnv?: Record<string, string>;

  constructor(
    commandStr: string,
    {
      env,
      quiet = false,
      redactedCommand,
      checkEnvYaml = false,
      envScope,
      cwd,
    }: CommandExecutorOptions = {}
  ) {
    this.env = env;
    this.quiet = quiet ?? false;
    this.commandStr = commandStr;
    this.checkEnvYaml = checkEnvYaml;
    this.redactedCommand = redactedCommand;
    this.envScope = envScope;
    this.cwd = cwd;
  }

  /** Non-interactive use only. stdout is returned. */
  exec(options?: {
    onlyStatusCode?: false;
    asObject?: false;
    env?: object;
  }): string;
  exec(options: { onlyStatusCode?: false; asObject: true; env?: object }): {
    statusCode: number;
    stdout: string;
    stderr: string;
  };
  exec(options: {
    onlyStatusCode: true;
    asObject?: boolean;
    env?: object;
  }): number;
  exec({
    onlyStatusCode = false,
    asObject = false,
    env = {},
  }: { onlyStatusCode?: boolean; asObject?: boolean; env?: object } = {}) {
    this._checkEnvYamlFiles();
    const fullCommand = this._prepareFullCommand();
    const envToUse = this._getProcessEnv(env);
    try {
      const output = execSync(fullCommand, { env: envToUse, cwd: this.cwd });
      if (onlyStatusCode) return 0;
      if (!this.quiet) console.log(output.toString());
      if (asObject) return { statusCode: 0, stdout: output.toString() };
      return output.toString();
    } catch (error) {
      const typedError = error as ExecSyncError;
      if (onlyStatusCode) return typedError.status;
      const stdout = typedError.stdout?.toString().trim();
      const stderr = typedError.stderr?.toString().trim();
      if (!this.quiet) {
        console.warn(stdout);
        console.error(stderr);
      }
      if (asObject) return { statusCode: typedError.status, stdout, stderr };
      process.exit(typedError.status);
    }
  }

  /** Should be used for CLI commands intended to be used locally. Provides interactivity. Unlike exec(), stdout is not returned. */
  spawn({ env, pipeStdoutTo }: { env?: object; pipeStdoutTo?: "stderr" } = {}) {
    this._checkEnvYamlFiles();
    const fullCommand = this._prepareFullCommand();
    const envToUse = this._getProcessEnv(env);
    const stdio: StdioOptions = pipeStdoutTo === "stderr" ? ["inherit", "pipe", "inherit"] : "inherit";
    return new Promise((resolve) => {
      try {
        const childProcess = spawn(fullCommand, {
          stdio,
          env: envToUse,
          cwd: this.cwd,
          shell: true,
        });

        if (pipeStdoutTo === "stderr") {
          childProcess.stdout?.pipe(process.stderr);
        }

        childProcess.on("close", (code) => {
          if (code !== 0) {
            console.error(chalk.red(`Process exited with code ${code}`));
            process.exit(code);
          }
          resolve(code);
        });

        childProcess.on("error", (error) => {
          console.error(chalk.red(`Error: ${error.message}`));
          process.exit(1);
        });
      } catch (error) {
        if (error instanceof Error) {
          console.error(chalk.red(`${error.message}`));
        }
        process.exit(1);
      }
    });
  }

  _prepareFullCommand() {
    const fullCommand = this.commandStr.trim();

    const envPrefixLog = this.env ? `MONOREPO_ENV=${this.env} MONOREPO_ROOT=${process.cwd()}` : "";
    const cwdLog = this.cwd ? `(in ${this.cwd})` : "";
    const fullCommandLog = [envPrefixLog, cwdLog, fullCommand].filter(Boolean).join(" ");
    if (this.redactedCommand) {
      console.warn(
        chalk.yellow(
          fullCommandLog.replace(this.commandStr, this.redactedCommand)
        )
      );
    } else {
      console.warn(chalk.yellow(fullCommandLog));
    }

    return fullCommand;
  }

  /** Variables already present in the process take precedence over those loaded from env files */
  _getProcessEnv(envOverride = {}) {
    return { ...this._getFileEnv(), ...process.env, MONOREPO_ENV: this.env, MONOREPO_ROOT: process.cwd(), ...envOverride };
  }

  _getFileEnv() {
    if (!this.env) return {};
    if (!this._fileEnv) {
      const fileEnv = loadDotEnvFiles(dotEnvFilesForEnv(this.env));
      this._fileEnv = this.envScope ? scopeEnvToWorkspace(fileEnv, this.envScope) : fileEnv;
    }
    return this._fileEnv;
  }

  _checkEnvYamlFiles() {
    if (!this.checkEnvYaml) return;
    validateEnvYamlFiles(this.env, { env: this._getProcessEnv(), envScope: this.envScope });
  }
}

/**
 * Validates env.yaml files against the given env, exiting the process on errors.
 * If envScope is given, only the env.yaml files of that workspace and its dependencies are validated.
 */
export function validateEnvYamlFiles(
  monorepoEnv: string | undefined,
  { env, envScope }: { env: Record<string, string | undefined>; envScope?: string }
) {
  const allEnvYamlFiles = globEnvYamlFiles();
  const envYamlFiles = envScope ? workspaceEnvYamlFiles(envScope) : allEnvYamlFiles;
  const declaredKeys = Object.keys(envRequirementsFromFiles(allEnvYamlFiles));
  const frameworkKeys = Object.keys(env).filter((key) => key.startsWith(ALWAYS_INJECTED_PREFIX));
  const validator = new CombinedEnvValidator(envYamlFiles, dotEnvFilesForEnv(monorepoEnv), {
    env,
    knownKeys: new Set([...declaredKeys, ...frameworkKeys]),
    // Images only contain the env.yaml files of their own workspaces, so unused keys cannot be determined reliably
    warnUnused: process.env.IS_KUBERNETES !== "true",
  });
  validator.validate();
}

export function dotEnvFilesForEnv(env?: string) {
  const globalEnvFilePath = "config/.env.global";
  const specificEnvFilePath = `config/.env.${env}`;

  const envFiles: string[] = [];
  if (env && fs.existsSync(specificEnvFilePath))
    envFiles.push(specificEnvFilePath);
  if (fs.existsSync(globalEnvFilePath)) envFiles.push(globalEnvFilePath);
  return envFiles;
}

export function printUsageAndExit(text: string): never {
  console.warn(text);
  process.exit(1);
}

export class StrongParams {
  constructor(private usage: string, private args: Record<string, string | undefined>) {}

  required(key: string) {
    if (!this.args[key]) {
      console.error(`Missing required argument: ${key}`);
      printUsageAndExit(this.usage);
    }
    return this.args[key];
  }

  /** Like required("image"), but also exits with the list of available images if the image does not exist */
  requiredImage() {
    const image = this.args["image"];
    if (!image) {
      console.warn(this.usage);
      console.error(`Missing required argument: image\n\n${availableImagesMessage()}\n`);
      process.exit(1);
    }
    return assertImageExists(image);
  }

  optional(key: string) {
    return this.args[key];
  }
}
