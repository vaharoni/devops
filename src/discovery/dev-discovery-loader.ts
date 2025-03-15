import fs from "fs";
import { globSync } from "glob";

import { type PkgData } from "../types";

let _devDiscoveryLoader: DevDiscoveryLoader | undefined;

// This must only be run in development, as in production Docker images do not necessarily have all folders in them.
export class DevDiscoveryLoader {
  packages: Record<string, PkgData> = {};

  static instance() {
    _devDiscoveryLoader ??= new DevDiscoveryLoader();
    return _devDiscoveryLoader;
  }

  constructor() {
    if (process.env["IS_KUBERNETES"] === "true")
      throw new Error(
        "DevDiscoveryLoader must only be used in local development"
      );

    globSync("../**/package.json").forEach((packageJsonPath) => {
      if (packageJsonPath.includes("node_modules")) return;
      const data = JSON.parse(
        fs.readFileSync(packageJsonPath, "utf8")
      ) as PkgData;
      const serviceName = data.deployment?.service_name;
      if (!serviceName) return;
      this.packages[serviceName] = data;
    });

    console.debug(
      `DevDiscoveryLoader initialized in ${process.cwd()} with applications: ${Object.keys(
        this.packages
      ).join(", ")}`
    );
  }

  getPkgData(serviceName: string) {
    return this.packages[serviceName];
  }

  getPort(serviceName: string) {
    return this.getPkgData(serviceName)?.deployment?.port;
  }
}
