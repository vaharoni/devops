import { CommandExecutor } from "../../cli/common";
import { z } from "zod";
import { getConst, getImageData } from "../config";

const repoTagMetadataSchema = z.object({
  // What we rely on
  tag: z.string().optional(),
  updated_at: z.string(),
  manifest_digest: z.string(),
  // Other fields that existed in the output
  // registry_name: z.string().optional(),
  // repository: z.string().optional(),
  // compressed_size_bytes: z.number().optional(),
  // size_bytes: z.number().optional(),
});
const repoTagMetadataSchemaOutput = z.array(repoTagMetadataSchema);

type RepoTagMetadata = z.infer<typeof repoTagMetadataSchema>;

/** The metadata is returned in descending order (most recent first) */
function getRepoTagMetadata(repoName: string): RepoTagMetadata[] {
  // Get the metadata for the tags in the repository
  const cmd = `doctl registry repository list-tags ${repoName} -o json`;
  const res = new CommandExecutor(cmd, { quiet: true }).exec();
  if (!res) return [];
  try {
    const parsed = JSON.parse(res);
    const parseRes = repoTagMetadataSchemaOutput.safeParse(parsed);
    if (parseRes.error) {
      console.error(
        `Error schema-parsing output from "${cmd}": ${parseRes.error.toString()}`
      );
      console.error(">>> Command output");
      console.error(res);
      process.exit(1);
    }
    return parseRes.data
      .filter((data) => data.tag)
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
  } catch (e) {
    console.error(`Error JSON-parsing output from "${cmd}": ${res}`);
    process.exit(1);
  }
}

function deleteRepoTag(repoName: string, tag: string) {
  const cmd = `doctl registry repository delete-tag ${repoName} ${tag} --force`;
  new CommandExecutor(cmd).exec();
}

function stargGarbageCollection(registryName: string) {
  const cmd = `doctl registry garbage-collection start --include-untagged-manifests ${registryName} --force`;
  new CommandExecutor(cmd).exec();
}

export function prune(
  /** To keep the image-related constants simple, this accepts the full URL including the prefix registry.digitalocean.com */
  registryFullName: string,
  /** The name of the repository inside the registry */
  repoName: string,
  image: string
) {
  const registryInfra = getConst("registry-infra");
  if (registryInfra !== "digitalocean") {
    console.warn(
      "Pruning is only supported for the DigitalOcean container registry"
    );
    return;
  }
  const imageData = getImageData(image);
  if (imageData["cloudrun"]) {
    console.warn(
      "Pruning is skipped for cloudrun images"
    );
    return;
  }
  const tags = getRepoTagMetadata(repoName);
  const versionsToKeep = Number(getConst("image-versions-to-keep"));
  if (!tags.length || tags.length <= versionsToKeep) return;
  const tagsToDelete = tags.slice(versionsToKeep);
  tagsToDelete.forEach((tag) => {
    deleteRepoTag(repoName, tag.tag!);
  });
  const registryName = registryFullName.split("/").slice(-1)[0];
  stargGarbageCollection(registryName);
}
