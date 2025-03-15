import { CommandExecutor } from "../cli/common";
import { kubectlCommand } from "./k8s-helpers";

export function getRedisList() {
  const cmd = kubectlCommand(`get pods -l app.kubernetes.io/name=redis -A`);
  const res = new CommandExecutor(cmd, { quiet: true }).exec();
  if (!res) return null;
  return res;
}

export function getRedisPassword(namespace: string) {
  const cmd = kubectlCommand(`get secrets/${namespace} -o jsonpath="{.data}"`, {
    namespace,
  });
  const res = new CommandExecutor(cmd, { quiet: true }).exec();
  if (!res) return null;
  try {
    const resJson = JSON.parse(res);
    const password = atob(resJson["redis-password"]);
    return { password };
  } catch {
    return null;
  }
}

export function establishRedisTunnel(namespace: string, port: string) {
  const cmd = kubectlCommand(`port-forward svc/${namespace}-master ${port}:6379`, {
    namespace,
  });
  new CommandExecutor(cmd).spawn();
}
