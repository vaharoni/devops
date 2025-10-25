import { CommandExecutor } from "../cli/common";
import { kubectlCommand } from "./k8s-helpers";

export function getRedisList() {
  const cmd = kubectlCommand(`get pods -l app=redis-ha -A`);
  const res = new CommandExecutor(cmd, { quiet: true }).exec();
  if (!res) return null;
  return res;
}

export function establishRedisTunnel(namespace: string, port: string) {
  const cmd = kubectlCommand(`port-forward svc/${namespace}-redis-ha ${port}:6379`, {
    namespace,
  });
  new CommandExecutor(cmd).spawn();
}
