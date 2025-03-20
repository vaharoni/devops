import { readFileSync } from "fs";
import yaml from "yaml";
import path from "path";
import { z } from "zod";
import { SUPPORTED_LANGUAGES } from "../types";
import { getWorkspace } from "./discovery";

const constFileSchema = z.object({
  "project-name": z.string(),
  "domains": z.record(z.string()),
  "infra": z.enum(["hetzner", "digitalocean"]),
  "image-versions-to-keep": z.number(),
  "registry-base-url": z.string(),
  "registry-name": z.string(),
  "extra-remote-environments": z.array(z.string()),
  "extra-local-environments": z.array(z.string()),
})
type ConstFileSchema = z.infer<typeof constFileSchema>;

const singleImageSchema = z.object({
  "language": z.enum(SUPPORTED_LANGUAGES),
  "debug-template": z.string(),
  "can-db-migrate": z.boolean().optional(),
  "image-extra-content": z.array(z.string()).optional(),
  applications: z.array(z.string()),
});
const imageSchema = z.record(singleImageSchema);
export type SingleImageSchema = z.infer<typeof singleImageSchema>;
export type ImageSchema = z.infer<typeof imageSchema>;

const constantsFilePath = path.join(process.cwd(), ".devops/config/constants.yaml");
const imagesFilePath = path.join(process.cwd(), ".devops/config/images.yaml");

// We want these to be lazy loaded so that calling devops in a context that does not need the config files won't fail
export const { getConst } = processConstFile();
export const { getImageData, getImageNames } = processImagesFile();

// Process config/constants.yaml

function processConstFile() {
  let constants: ConstFileSchema;
  function constFileData() {
    if (constants) return constants;
    try {
      const constantsYaml = readFileSync(constantsFilePath, "utf8");
      constants = yaml.parse(constantsYaml);
    } catch (e) {
      console.error("Error reading .devops/config/constants.yaml");
      process.exit(1);
    }
    const parseRes = constFileSchema.safeParse(constants);
    if (parseRes.error) {
      console.error(
        `Error parsing config/constants.yaml: ${parseRes.error.toString()}`
      );
      process.exit(1);
    }
    return constants;
  }

  function getConst<T extends keyof ConstFileSchema>(key: T): ConstFileSchema[T] {
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
      if (!data) {
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
