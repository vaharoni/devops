import { deleteImageVersion, getImageVersion, getWorkspaceScale, resetWorkspaceScale, setImageVersion, setWorkspaceScale } from "../libs/k8s-image-config";
import { CLICommandParser, printUsageAndExit, StrongParams } from "../../src/cli/common";
import { generateImageDeployments } from "../libs/k8s-generate";
import { applyHandler } from "../libs/k8s-helpers";

const oneLiner = "Applies image-related manifests, retrieves or set the version deployed, and scales deployments of applications";
const keyExamples = `
    $ devops image deployment gen    main-node sha  --env staging
    $ devops image deployment create main-node sha  --env staging
    $ devops image deployment delete main-node      --env staging
    $ devops image version    get    main-node      --env staging
    $ devops image version    set    main-node sha  --env staging
    $ devops image version    unset  main-node      --env staging
    $ devops image scale      get    main-node       --env staging
    $ devops image scale      get    main-node www   --env staging
    $ devops image scale      set    main-node www 3 --env staging
    $ devops image scale      unset  main-node       --env staging
    $ devops image scale      unset  main-node www   --env staging
`.trim();

const usage = `
${oneLiner}

GENERATING DEPLOYMENT MANIFESTS
    devops image deployment gen|create|delete <image-name> <sha>

    gen     - generates the manifest file with all applications that are deployed with the image
    create  - generates the manifest file and then runs kubectl apply
    delete  - generates the manifest file and then runs kubectl delete

MANAGINE APPLICATION SCALE
    devops image scale get|unset <image-name> [<workspace-name>]
    devops image scale set <image-name> <workspace-name> <replica-count>

    set    - sets the scale count in the image's config map so that it persists across deployments. 
    get    - retrieves the current scale count. If workspace is not provided, all workspaces are returned.
    unset  - resets the scale count by removing the key from the image's config map. If workspace is not provided, all workspaces are reset.

    Both 'set' and 'unset' return the previous scale count prior to the operation.

MANAGING IMAGE VERSIONS
    devops image version get|unset <image> 
    devops image version set <image> <sha>

    Meant to be called during deployment in order to maintain a record of the most recent deployed version.

EXAMPLES
    ${keyExamples}
`;

const handlers = {
  deployment: {
    gen: (opts: StrongParams) => {
      console.log(
        generateImageDeployments(
          opts.required("env"), 
          opts.required("image"),
          opts.required("sha")
        )
      )
    },
    create: (opts: StrongParams) => {
      applyHandler(
        'apply-deployment-', 
        'apply', 
        generateImageDeployments(
          opts.required("env"), 
          opts.required("image"),
          opts.required("sha")
        )
      )
    },
    delete: (opts: StrongParams) => {
      applyHandler(
        'delete-deployment-', 
        'delete', 
        generateImageDeployments(
          opts.required("env"), 
          opts.required("image"),
          "dummy-sha"
        )
      )
    },
  },
  scale: {
    set: (opts: StrongParams) => {
      const workspace = opts.required("workspace");
      const image = opts.required("image");
      const replicas = Number(opts.required("replicas"));
      const res = setWorkspaceScale(
        opts.required("env"),
        image,
        workspace,
        replicas
      );
      if (res) {
        console.warn(
          `Scale for ${workspace} in ${image} set to ${replicas}. Previous value:`
        );
        console.log(res);
      }
    },
    get: (opts: StrongParams) => {
      const workspace = opts.optional("workspace");
      // Satiate the type checker
      if (!workspace) {
        console.log(
          getWorkspaceScale(
            opts.required("env"),
            opts.required("image"),
          )
        )
      } else {
        console.log(
          getWorkspaceScale(
            opts.required("env"),
            opts.required("image"),
            workspace
          )
        )
      }
    },
    unset: (opts: StrongParams) => {
      const image = opts.required("image");
      const workspace = opts.optional("workspace");
  
      const prev = resetWorkspaceScale(opts.required("env"), image, workspace);
      if (workspace) {
        console.warn(`Scale for ${workspace} in ${image} unset. Previous scale:`);
        console.log(prev);
      } else {
        console.warn(
          `Scale for all workspaces in ${image} unset. Previous scale:`
        );
        console.log(prev);
      }
    },
  },
  version: {
    get: (opts: StrongParams) => {
      const version = getImageVersion(
        opts.required("env"),
        opts.required("image")
      )
      console.log(version ?? "")
    },
    set: (opts: StrongParams) => {
      setImageVersion(
        opts.required("env"),
        opts.required("image"),
        opts.required("sha")
      )
    },
    unset: (opts: StrongParams) => {
      deleteImageVersion(
        opts.required("env"),
        opts.required("image")
      )
    },
  },
};

function run(cmdObj: CLICommandParser) {
  if (cmdObj.help || cmdObj.args.length < 1) printUsageAndExit(usage);

  const [command, subcommand, image, param1, param2] = cmdObj.args;
  const commandHandler = handlers[command as keyof typeof handlers];
  if (!commandHandler) {
    console.error(`Unknown command: ${command}`);
    printUsageAndExit(usage);
  }
  const handler = commandHandler[subcommand as keyof typeof commandHandler] as (opts: StrongParams) => void;
  if (!handler) {
    console.error(`Unknown subcommand: ${subcommand}`);
    printUsageAndExit(usage);
  }

  function getExtraParams() {
    if (command === 'scale') {
      return subcommand === 'set' ? { workspace: param1, replicas: param2 } : { workspace: param1 };
    } else {
      return { sha: param1 };
    }
  }

  const params = new StrongParams(usage, {
    env: cmdObj.env,
    subcommand,
    image,
    ...getExtraParams()
  });
  handler(params);
}

export default {
  image: { oneLiner, keyExamples, run },
};
