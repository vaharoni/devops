import { workspaces } from "../../libs/discovery";

let _portLookupByServiceName: Record<string, number> | null = null;

function getPortLookup() {
  if (_portLookupByServiceName) return _portLookupByServiceName;
  if (process.env["IS_KUBERNETES"] === "true") {
    throw new Error(
      "getPortLookup() should only be used in local development. In production, the service name is sufficient."
    );
  }

  _portLookupByServiceName = {};
  Object.values(workspaces()).forEach((workspace) => {
    workspace.packageDataEntries.forEach((pkg) => {
      const serviceName = pkg.deployment?.service_name;
      const port = pkg.deployment?.port;
      if (!serviceName || !port) return;
      const existing = _portLookupByServiceName![serviceName];
      if (!existing) {
        _portLookupByServiceName![serviceName] = port;
      } else if (existing !== port) {
        console.error(
          `Service name ${serviceName} has conflicting ports: ${existing} and ${port}`
        );
        process.exit(1);
      }
    });
  });
  return _portLookupByServiceName;
}

export function getPortForServiceName(serviceName: string) {
  return getPortLookup()[serviceName];
}
