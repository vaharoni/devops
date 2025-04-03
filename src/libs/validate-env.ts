import fs from 'fs';
import yaml from 'yaml';
import { IGNORED_PATHS } from './discovery/process-common';

type EnvRequirement = 'optional' | 'boolean' | 'required' | string[];
type ParsedEnvYaml = Record<string, EnvRequirement>;
type CombinedErrors = Record<string, string[]>;
type KeysFromFiles = Record<string, string[]>;

export class CombinedEnvValidator {
  envYamlPaths: string[];
  dotEnvPaths: string[];

  yamlValidators: SingleEnvValidator[] = [];
  dotEnvParsers: DotEnvParser[] = [];

  keysFromYamlFiles: Set<string> = new Set();
  keysFromDotEnvFiles: KeysFromFiles = {};

  errors: CombinedErrors = {};
  warnings: string[] = [];

  constructor(envYamlPaths: string[], dotEnvPaths: string[] = []) {
    this.envYamlPaths = envYamlPaths.filter(path => 
      !IGNORED_PATHS.some((ignoredPath) => path.includes(ignoredPath))
    )
    this.dotEnvPaths = dotEnvPaths;
  }

  validate() {
    this._handleYamlFiles();
    this._handleDotEnvFiles();
    this._finalize();
  }

  _handleYamlFiles() {
    this._loadYamlFiles(this.envYamlPaths);
    this._validateYamlFiles();
    this._haltIfParsingErrors();
    this._extractErrors();
  }

  _handleDotEnvFiles() {
    this._loadDotEnvFiles(this.dotEnvPaths);
    this._parseDotEnvFiles();
    this._combineDotEnvFiles();
    this._extractWarnings();
  }

  _loadYamlFiles(envYamlPaths: string[]) {
    envYamlPaths.forEach((path) => {
      const validator = new SingleEnvValidator(path);
      this.yamlValidators.push(validator);
    });
  }

  _validateYamlFiles() {
    this.yamlValidators.forEach((x) => x.validate());
  }

  _haltIfParsingErrors() {
    const filesWithParsingErrors = this.yamlValidators.filter((validator) =>
      Boolean(validator.parsingError),
    );
    if (filesWithParsingErrors.length === 0) return;

    console.error('The following env.yaml files have parsing errors:');
    filesWithParsingErrors.forEach((validator: SingleEnvValidator) => {
      console.error(`\t${validator.parsingError}`);
    });
    process.exit(1);
  }

  _extractErrors() {
    this.yamlValidators.forEach((validator) => {
      Object.keys(validator.parsedEnvYaml ?? {}).forEach((envVar) => {
        this.keysFromYamlFiles.add(envVar);
      });
      Object.entries(validator.errors).forEach(([envVar, error]) => {
        this.errors[envVar] ??= [];
        this.errors[envVar].push(error);
      });
    });
  }

  _loadDotEnvFiles(dotEnvPaths: string[] = []) {
    dotEnvPaths.forEach((path) => {
      const parser = new DotEnvParser(path);
      this.dotEnvParsers.push(parser);
    });
  }

  _parseDotEnvFiles() {
    this.dotEnvParsers.forEach((x) => x.parse());
  }

  _combineDotEnvFiles() {
    this.dotEnvParsers.forEach((parser) => {
      if (!parser.keys) return;
      parser.keys.forEach((key) => {
        this.keysFromDotEnvFiles[key] ??= [];
        this.keysFromDotEnvFiles[key].push(parser.path);
      });
    });
  }

  _extractWarnings() {
    const unusedKeys = Object.keys(this.keysFromDotEnvFiles).filter(
      (x) => !this.keysFromYamlFiles.has(x),
    );
    unusedKeys.forEach((x) => {
      this.warnings.push(`${x} in: ${this.keysFromDotEnvFiles[x].join(', ')}`);
    });
  }

  _finalize() {
    if (this.warnings.length > 0) {
      console.error(
        'WARNING: some env variables exist in .env but not in env.yaml:',
      );
      this.warnings.forEach((warning) => console.error(`\t${warning}`));
      console.error();
    }
    if (Object.keys(this.errors).length > 0) {
      Object.entries(this.errors).forEach(([key, errors]) => {
        console.error(`Errors for ${key}:`);
        errors.forEach((error) => console.error(`\t${error}`));
        console.error();
      });
      console.error();
      process.exit(1);
    }
  }
}

/**
 * While we don't strictly need to parse .env files (we can simply use process.env), it is useful to give
 * warnings to the user that there are unused entries in .env files compared to the stated requirements
 * captured in env.yaml files.
 */
export class DotEnvParser {
  path: string;
  keys: string[] | undefined;

  constructor(path: string) {
    this.path = path;
  }

  parse() {
    const text = this._readFile(this.path);
    if (text) this.keys = this._parse(text);
  }

  _readFile(path: string) {
    if (!fs.existsSync(path)) return;
    return fs.readFileSync(path).toString();
  }

  _parse(text: string) {
    const lines = text.split('\n');
    const withoutComments = lines
      .map((x) => x.replace(/#.*$/, '').trim())
      .filter(Boolean);
    const keys = withoutComments
      .map((x) => x.split('=').map((y) => y.trim()))
      .filter((x) => x.length > 1)
      .map((x) => x[0]);
    return keys;
  }
}

export class SingleEnvValidator {
  envYamlPath: string;
  parsedEnvYaml: ParsedEnvYaml | undefined;
  parsingError: string | undefined;
  errors: Record<string, string> = {};

  constructor(envYamlPath: string) {
    this.envYamlPath = envYamlPath;
  }

  validate() {
    this.parsedEnvYaml = this._parse();
    if (!this.parsingError) this._addAllErrors();
  }

  _readFile() {
    if (!fs.existsSync(this.envYamlPath)) {
      console.error(`Skipping ${this.envYamlPath}: does not exist`);
      return;
    }
    return yaml.parse(fs.readFileSync(this.envYamlPath).toString());
  }

  _generateError(message: string) {
    return `Error in ${this.envYamlPath}: ${message}`;
  }

  _setParsingError(message: string) {
    this.parsingError = this._generateError(message);
  }

  _addError(key: string, message: string) {
    this.errors[key] = this._generateError(message);
  }

  _parse() {
    const allEnv: ParsedEnvYaml = {};
    const envManifest = this._readFile();
    if (!envManifest) return;
    if (!(envManifest instanceof Array)) {
      this._setParsingError(`env.yaml file must resolve to an array`);
      return;
    }
    envManifest.forEach((env: string | object) => {
      if (env instanceof Object) {
        const entries = Object.entries(env);
        if (entries.length > 1) {
          this._setParsingError(
            `every object in env.yaml must have one key. Error near: ${entries[0][0]}`,
          );
          return;
        }
        const [name, value] = entries[0];
        if (
          !(value instanceof Array) &&
          !['optional', 'boolean'].includes(value as string)
        ) {
          this._setParsingError(
            `invalid value for ${name}: ${JSON.stringify(value)}`,
          );
          return;
        }
        allEnv[name] = value;
      } else {
        allEnv[env] = 'required';
      }
    });
    return allEnv;
  }

  _addAllErrors() {
    Object.entries(this.parsedEnvYaml!).forEach(([key, requirement]) => {
      const value = process.env[key];
      if (requirement !== 'optional' && !value) {
        this._addError(key, `${key} is required but missing`);
      } else if (
        requirement === 'boolean' &&
        !['true', 'false'].includes(String(value))
      ) {
        this._addError(
          key,
          `${key} must be either true or false. Value: ${value}`,
        );
      } else if (
        requirement instanceof Array &&
        !requirement.includes(value ?? '')
      ) {
        this._addError(
          key,
          `${key} must be one of ${requirement.join(', ')}. Value: ${value}`,
        );
      }
    });
  }
}
