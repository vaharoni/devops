import { CommandExecutor } from "../cli/common";
import { envToNamespace } from "./k8s-constants";
import { kubectlCommand } from "./k8s-helpers";

const POLL_INTERVAL_SEC = 1;

export type JobStatuses = Record<
  string,
  { status: "success" | "failure" | "timeout"; elapsed: number; error?: string }
>;

class K8sJobWaiter {
  timeoutInMs: number;
  namespace: string;
  jobStatuses: JobStatuses;

  constructor(public monorepoEnv: string, timeoutInS: number) {
    this.namespace = envToNamespace(monorepoEnv);
    this.jobStatuses = {};
    this.timeoutInMs = timeoutInS * 1000;
  }

  async pollJob(job: string) {
    const startTime = Date.now();

    while (true) {
      const res = await this.fetchStatus(job);
      const elapsed = Date.now() - startTime;

      if (res.failure > 0) {
        const error = await this.fetchError(job);
        this.jobStatuses[job] = { status: "failure", elapsed, error };
        return;
      }

      if (res.success > 0) {
        this.jobStatuses[job] = { status: "success", elapsed };
        return;
      }

      if (elapsed >= this.timeoutInMs) {
        this.jobStatuses[job] = { status: "timeout", elapsed };
        return;
      }

      await new Promise((res) => setTimeout(res, POLL_INTERVAL_SEC * 1000));
    }
  }

  private async fetchStatus(job: string) {
    const result = new CommandExecutor(
      kubectlCommand(
        `get job ${job} -o jsonpath='{.status.failed},{.status.succeeded}'`,
        { namespace: this.namespace }
      )
    ).exec();
    const [failure, success] = result.split(",").map((x: string) => Number(x));
    return { failure, success };
  }

  private async fetchError(job: string) {
    try {
      const podName = new CommandExecutor(
        kubectlCommand(`get pod -l job-name=${job} -o name`, {
          namespace: this.namespace,
        })
      ).exec();
      const logs = new CommandExecutor(
        kubectlCommand(`logs ${podName}`, { namespace: this.namespace })
      ).exec();
      return logs;
    } catch (e) {
      console.log("Error fetching logs for job", { job, e });
      return `<COULD NOT FETCH ERROR FOR ${job}>`;
    }
  }
}

export async function k8sJobWaiter(
  monorepoEnv: string,
  timeoutInS: number,
  jobs: string[]
) {
  const waiter = new K8sJobWaiter(monorepoEnv, timeoutInS);
  await Promise.all(jobs.map((job) => waiter.pollJob(job)));
  return waiter.jobStatuses;
}

export function printJobStatuses(statuses: JobStatuses) {
  console.log("Statuses:");
  Object.entries(statuses).forEach(([job, statusRecord]) => {
    console.log(
      `${job}: ${statusRecord.status} ${
        Math.round((statusRecord.elapsed / 1000) * 100) / 100
      }s`
    );
  });
  console.log();

  Object.entries(statuses)
    .filter(([_, statusRecord]) => statusRecord.status === "failure")
    .forEach(([job, statusRecord]) => {
      console.error(`Error for ${job}:`);
      console.error(statusRecord.error);
      console.error();
    });

  const failures = Object.entries(statuses).filter(([_, statusRecord]) =>
    ["failure", "timeout"].includes(statusRecord.status)
  );

  if (failures.length > 0) {
    console.error();
    console.error(
      `Some jobs did not succeed: ${failures.map(([job, _]) => job).join(", ")}`
    );
    console.error();
    process.exit(1);
  }

  Object.entries(statuses).forEach(([job, statusRecord]) => {
    console.log(`${job}: ${statusRecord.status}`);
  });
}
