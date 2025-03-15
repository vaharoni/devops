import {
  findImagesAffected,
  findImageWithAffectedWorkspace,
  isImageAffected,
  isWorkspaceAffected,
} from "../libs/affected-entities";
import { CLICommandParser, printUsageAndExit, StrongParams } from "./common";

const oneLiner =
  "Command to check whether an image or a workspace is affected by certain commit(s)";
const keyExamples = `
    $ ./devops affected list-images
    $ ./devops affected workspace db --base <sha1> --head <sha2>
    $ ./devops affected image node-services --from-live-version
    $ ./devops affected find-migrator --from-live-version
`;

const usage = `
${oneLiner}

GENERAL USAGE
  List
    ./devops affected list-images --base [SHA1] --head [SHA2]
    ./devops affected list-images --from-live-version

    These return a list of all images affected by the given commits.

  Checkers
    ./devops affected workspace <workspace> --base [SHA1] --head [SHA2]

    ./devops affected image     <image>     --base [SHA1] --head [SHA2]
    ./devops affected image     <image>     --from-live-version

    These return "true" or "false". 

  Finders
    ./devops affected find-migrator --base [SHA1] --head [SHA2]
    ./devops affected find-migrator --from-live-version

    When --base and --head are used, it checks whether the db project is affected. If it is, it returns the name of one random 
    affected image.
    When --from-live-version is used, it iterates on the live version of each image that depends on db, and returns the first image that is 
    affected by a db project change since that commit.

    If the db project is unaffected, returns an empty string.

  Options
    Which commits are regarded for the affected calculation can be changed using:
    --base               Base of the current branch (HEAD^ by default)
    --head               Latest commit of the current branch (HEAD by default)
    --from-live-version  Use the live version of the image/workspace as the base (see ./devops k8s get version)

    If --from-live-version is present, --base and --head are ignored.

EXAMPLES
    ${keyExamples.trim()}
`;

async function run(cmdObj: CLICommandParser) {
  const options = cmdObj.parseOptions({
    params: ["--base", "--head"],
    booleans: ["--from-live-version"],
  });
  if (cmdObj.help || options.args.length < 1) printUsageAndExit(usage);
  const baseSha = options.options["--base"]?.toString();
  const headSha = options.options["--head"]?.toString();
  const fromLiveVersion = Boolean(options.options["--from-live-version"]);
  const commonOpts = {
    baseSha,
    headSha,
    fromLiveVersion,
    monorepoEnv: cmdObj.env,
  };

  const [cmd, imageOrWorkspace] = options.args;
  const params = new StrongParams(usage, { imageOrWorkspace });

  switch (cmd) {
    case "list-images": {
      console.log(findImagesAffected(commonOpts).join("\n"));
      break;
    }
    case "workspace": {
      // prettier-ignore
      const affected = isWorkspaceAffected(params.required("imageOrWorkspace"), commonOpts);
      console.log(affected ? "true" : "false");
      break;
    }
    case "image": {
      const affected = isImageAffected(
        params.required("imageOrWorkspace"),
        commonOpts
      );
      console.log(affected ? "true" : "false");
      break;
    }
    case "find-migrator": {
      console.log(findImageWithAffectedWorkspace("db", commonOpts));
      break;
    }
    default:
      printUsageAndExit(usage);
  }
}

export default {
  affected: { oneLiner, keyExamples, run },
};
