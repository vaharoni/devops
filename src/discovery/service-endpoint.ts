import { DevDiscoveryLoader } from "./dev-discovery-loader";

export function getServiceEndpoint(serviceName: string): string {
  if (process.env["IS_KUBERNETES"] === "true") {
    return `http://${serviceName}`;
  }

  const servicePort = DevDiscoveryLoader.instance().getPort(serviceName);
  if (!servicePort)
    throw new Error(`Port not found for service ${serviceName}`);
  return `http://127.0.0.1:${servicePort}`;
}
