import { readFileSync } from "fs";
import yaml from "yaml";
import path from "path";
import { getWorkspace } from "./discovery";
import { constFileSchema, imageFileSchema, type ConstFileSchema, type ImageFileSchema, type SingleImageSchema, type SingleTemplateSchema } from "../types";

const constantsFilePath = path.join(process.cwd(), ".devops/config/constants.yaml");
const imagesFilePath = path.join(process.cwd(), ".devops/config/images.yaml");

// We want these to be lazy loaded so that calling devops in a context that does not need the config files won't fail
export const { getConst } = processConstFile();
export const { getImageData, getImageNames, getTemplateData } = processImagesFile();

// Process config/constants.yaml

function processConstFile() {
  let constants: { valid: boolean, data?: ConstFileSchema };
  function constFileData() {
    if (constants) return constants;
    try {
      const constantsYaml = readFileSync(constantsFilePath, "utf8");
      constants = yaml.parse(constantsYaml);
    } catch (e) {
      // This is only a warning - the file may not exist, which is fine if getConst is called with ignoreIfInvalid
      console.warn("Warning: cannot read .devops/config/constants.yaml");
      return { valid: false };
    }
    const parseRes = constFileSchema.safeParse(constants);
    if (parseRes.error) {
      // This is an error - if the file exists, it must be valid
      console.error(`Error parsing config/constants.yaml: ${parseRes.error.toString()}`);
      process.exit(1);
    }
    constants = { valid: true, data: parseRes.data };
    return constants;
  }

  function getConst<T extends keyof ConstFileSchema>(key: T, opts: { ignoreIfInvalid?: boolean } = {}): ConstFileSchema[T] | undefined {
    const { valid, data } = constFileData();
    if (!valid && !opts.ignoreIfInvalid) { 
      console.error(".devops/config/constants.yaml is invalid");
      process.exit(1);
    }
    const value = data?.[key];
    if (!value && !opts.ignoreIfInvalid) {
      console.error(`Missing constant in .devops/config/constants.yaml: ${key}`);
      process.exit(1);
    }
    return value;
  }

  return { getConst };
}

// Process config/images.yaml

function processImagesFile() {
  let images: ImageFileSchema;
  function imagesFileData() {
    if (images) return images;
    try {
      const imagesYaml = readFileSync(imagesFilePath, "utf8");
      images = yaml.parse(imagesYaml);
    } catch (e) {
      console.error("Error reading .devops/config/images.yaml");
      process.exit(1);
    }
    const parseRes = imageFileSchema.safeParse(images);
    if (parseRes.error) {
      console.error(
        `Error parsing config/images.yaml: ${parseRes.error.toString()}`
      );
      process.exit(1);
    }
    return images;
  }

  function getImageData(imageName: string): SingleImageSchema {
    const imageData = imagesFileData()['images'][imageName];
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

  function getTemplateData(templateName: string): SingleTemplateSchema {
    const templateData = imagesFileData()['templates'][templateName];
    if (!templateData) {
      console.error(
        `Template ${templateName} not found in .devops/config/images.yaml`
      );
      process.exit(1);
    }

    return templateData;
  }

  function getImageNames() {
    return Object.keys(imagesFileData()["images"]);
  }

  return { getImageData, getImageNames, getTemplateData };
}
