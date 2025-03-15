import { CommandExecutor } from "../cli/common";
import { kubectlCommand } from "./k8s-helpers";

export function getDbList() {
  const cmd = kubectlCommand(`get sgcluster -A`);
  const res = new CommandExecutor(cmd, { quiet: true }).exec();
  if (!res) return null;
  return res;
}

export function getDbBackups() {
  const cmd = kubectlCommand(`get sgbkp -A`);
  const res = new CommandExecutor(cmd, { quiet: true }).exec();
  if (!res) return null;
  return res;
}

export function getDbAdminPassword() {
  const cmd = kubectlCommand(
    `get secrets/stackgres-restapi-admin -o jsonpath="{.data}"`,
    { namespace: "stackgres" }
  );
  const res = new CommandExecutor(cmd, { quiet: true }).exec();
  if (!res) return null;
  try {
    const resJson = JSON.parse(res);
    const password = atob(resJson["clearPassword"]);
    const user = atob(resJson["k8sUsername"]);
    return { user, password };
  } catch {
    return null;
  }
}

export function getDbPasswords(namespace: string) {
  const cmd = kubectlCommand(`get secrets/${namespace} -o jsonpath="{.data}"`, {
    namespace,
  });
  const res = new CommandExecutor(cmd, { quiet: true }).exec();
  if (!res) return null;
  try {
    const resJson = JSON.parse(res);
    const superUser = atob(resJson["superuser-username"]);
    const superPassword = atob(resJson["superuser-password"]);
    const authenticatorUser = atob(resJson["authenticator-username"]);
    const authenticatorPassword = atob(resJson["authenticator-password"]);
    const replicationUser = atob(resJson["replication-username"]);
    const replicationPassword = atob(resJson["replication-password"]);
    return {
      superUser,
      superPassword,
      authenticatorUser,
      authenticatorPassword,
      replicationUser,
      replicationPassword,
    };
  } catch {
    return null;
  }
}

export function connectToPatroni(namespace: string) {
  const cmd = kubectlCommand(
    `exec -it ${namespace}-0 -c patroni -- /bin/bash`,
    { namespace }
  );
  new CommandExecutor(cmd).spawn();
}

export function connectToPsql(namespace: string) {
  const cmd = kubectlCommand(
    `exec -it ${namespace}-0 -c postgres-util -- psql`,
    { namespace }
  );
  new CommandExecutor(cmd).spawn();
}

export function establishTunnel(namespace: string, port: string) {
  const cmd = kubectlCommand(`port-forward pod/${namespace}-0 ${port}:5432`, {
    namespace,
  });
  new CommandExecutor(cmd).spawn();
}
