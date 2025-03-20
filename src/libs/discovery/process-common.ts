import type { ZodSchema } from "zod";
import type { PackageData, SupportedLanguages } from "../../types";
import fs from "fs";
import path from "path"

const IGNORED_PATHS = ["node_modules/", "venv/"];

type PackageDataProcessorConfig<T> = {
  language: SupportedLanguages;
  pathList: string[];
  zodSchema: ZodSchema<T>;
  fileParser: (fileStringData: string) => unknown;
  nameExtractor: (data: T) => string;
}

export class PackageDataProcessor<T> {
  workspaceNames: Set<string> = new Set();
  loadedFiles: Record<string, { name: string, data: T }> = {};
  language: SupportedLanguages;
  nameExtractor: (data: T) => string;

  constructor(config: PackageDataProcessorConfig<T>) {
    this.language = config.language;
    this.nameExtractor = config.nameExtractor;
    this._runFirstPass(config.pathList, config.zodSchema, config.fileParser);
  }

  _runFirstPass(pathList: string[], zodSchema: ZodSchema<T>, fileParser: (fileStringData: string) => unknown) {
    pathList.forEach((packageFilePath) => {
      if (IGNORED_PATHS.find(path => packageFilePath.includes(path))) return;
      const unsafeData = fileParser(fs.readFileSync(packageFilePath, "utf8"));
      const parsedRes = zodSchema.safeParse(unsafeData);
      if (parsedRes.error) {
        console.error(`Error parsing ${packageFilePath}: ${parsedRes.error}`);
        process.exit(1);
      }
      const rootDir = path.dirname(packageFilePath);
      const name = this.nameExtractor(parsedRes.data)
      this.workspaceNames.add(name);
      this.loadedFiles[rootDir] = { name, data: parsedRes.data };
    });
  }

  // Should be used by the iterator sent to convert in order to filter out dependencies that are not workspaces
  filterDependencies(dependencyNames: string[]) {
    return dependencyNames.filter((name) => this.workspaceNames.has(name));
  }

  convert(iterator: (data: T) => Omit<PackageData, 'rootPath' | 'language' | 'name'>): PackageData[] {
    return Object.entries(this.loadedFiles).map(([rootPath, { name, data }]) => {
      const res = iterator(data);
      return { rootPath, language: this.language, name, ...res };
    })
  }
}