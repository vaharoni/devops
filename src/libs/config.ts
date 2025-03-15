import { readFileSync } from "fs";
import yaml from "yaml";
import path from "path";
import { getWorkspace } from "./workspace-discovery";
import { z } from "zod";

export type AvailableConstKeys =
  | "project-name"
  | "production-domain"
  | "staging-domain"
  | "image-versions-to-keep"
  | "infra"
  | "registry-base-url"
  | "registry-name";

const singleImageSchema = z.object({
  "docker-file": z.string(),
  "debug-template": z.string(),
  applications: z.array(z.string()),
});
const imageSchema = z.record(singleImageSchema);
export type SingleImageSchema = z.infer<typeof singleImageSchema>;
export type ImageSchema = z.infer<typeof imageSchema>;

const constantsFilePath = path.join(
  process.cwd(),
  ".devops/config/constants.yaml"
);
const imagesFilePath = path.join(process.cwd(), ".devops/config/images.yaml");

// We want these to be lazy loaded so that calling devops in a context that does not need the config files won't fail
export const { getConst } = processConstFile();
export const { getImageData, getImageNames } = processImagesFile();

// Process config/constants.yaml

function processConstFile() {
  let constants: Record<string, string>;
  function constFileData() {
    if (constants) return constants;
    let constantsYaml: string;
    try {
      constantsYaml = readFileSync(constantsFilePath, "utf8");
    } catch (e) {
      console.error("Error reading .devops/config/constants.yaml");
      process.exit(1);
    }
    constants = yaml.parse(constantsYaml);
    return constants;
  }

  function getConst(key: AvailableConstKeys) {
    const value = constFileData()[key];
    if (!value) {
      console.error(
        `Missing constant in .devops/config/constants.yaml: ${key}`
      );
      process.exit(1);
    }
    return value;
  }

  return { getConst };
}

// Process config/images.yaml

function processImagesFile() {
  let images: ImageSchema;
  function imagesFileData() {
    if (images) return images;
    try {
      const imagesYaml = readFileSync(imagesFilePath, "utf8");
      images = yaml.parse(imagesYaml);
    } catch (e) {
      console.error("Error reading .devops/config/images.yaml");
      process.exit(1);
    }
    const parseRes = imageSchema.safeParse(images);
    if (parseRes.error) {
      console.error(
        `Error parsing config/images.yaml: ${parseRes.error.toString()}`
      );
      process.exit(1);
    }
    return images;
  }

  function getImageData(imageName: string): SingleImageSchema {
    const imageData = imagesFileData()[imageName];
    if (!imageData) {
      console.error(
        `Image ${imageName} not found in .devops/config/images.yaml`
      );
      process.exit(1);
    }

    imageData.applications.forEach((project: string) => {
      const data = getWorkspace(project);
      if (!data.data) {
        console.error(
          `Project ${project} not found for image ${imageName} in .devops/config/images.yaml`
        );
        process.exit(1);
      }
    });

    return imageData;
  }

  function getImageNames() {
    return Object.keys(imagesFileData());
  }

  return { getImageData, getImageNames };
}
