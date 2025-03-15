import fs from "fs";
import { CommandExecutor } from "../../cli/common";
import { envToNamespace, secretName } from "./k8s-constants";
import yaml from "yaml";
import url from "url";
import path from "path";
import { BASE_SECRET_KEY } from "../k8s-base-secret";

const __file__ = url.fileURLToPath(import.meta.url);
const __src__ = path.join(path.dirname(__file__), "../../..", "src");

// prettier-ignore
const COMPOSITE_TEMPLATES_INDEX_PATH = path.join(__src__, "k8s/composite-templates.yaml");
// prettier-ignore
const MANIFEST_TEMPLATES_PATH = path.join(__src__, "k8s/templates");

const { getCompositeTemplateContent } = processCompositeTemplatesIndex();

// Preserves quotes
function substitutionCommand(content: string) {
  return `cat <<EOF | envsubst
${content}
EOF`;
}

function runSubstitution(content: string, env: Record<string, string>) {
  return new CommandExecutor(substitutionCommand(content), { quiet: true })
    .exec({ env })
    .trim();
}

export class AbstractGenerator {
  static method: "manifest" | "composite";
  /** When method is composite */
  static supported?: string[];
  /** When method is manifest */
  static manifest?: string;

  namespace: string;

  constructor(public monorepoEnv: string) {
    // This also performs validations on monorepoEnv
    this.namespace = envToNamespace(monorepoEnv);
  }

  get getConstructor() {
    return this.constructor as typeof AbstractGenerator;
  }

  getVars() {
    return {
      MONOREPO_ENV: this.monorepoEnv,
      MONOREPO_NAMESPACE: this.namespace,
      MONOREPO_SECRET_NAME: secretName(),
      MONOREPO_BASE_SECRET_KEY: BASE_SECRET_KEY
    };
  }

  generate(folder?: string) {
    const method = this.getConstructor["method"];
    if (method === "composite") {
      return this._generateComposite(folder);
    } else if (method === "manifest") {
      return this._generateManifest();
    } else {
      throw new Error(`Unknown method ${method} for ${this.constructor.name}`);
    }
  }

  _generateComposite(entry?: string) {
    if (!entry) {
      throw new Error("Entry must be provided");
    }
    const method = this.getConstructor["method"];
    if (method !== "composite") {
      throw new Error(
        `Cannot use _generateComposite with ${this.constructor.name}`
      );
    }
    const supported = this.getConstructor["supported"];
    if (!supported) {
      throw new Error(
        `supported static property must be defined on ${this.constructor.name}`
      );
    }
    if (!supported.includes(entry)) {
      throw new Error(
        `Entry ${entry} is not supported by ${this.constructor.name}`
      );
    }
    const content = getCompositeTemplateContent(entry).join("\n---\n");
    return runSubstitution(content, this.getVars());
  }

  _generateManifest() {
    const method = this.getConstructor["method"];
    if (method !== "manifest") {
      throw new Error(
        `Cannot use _generateManifest with ${this.constructor.name}`
      );
    }
    const manifest = this.getConstructor["manifest"];
    if (!manifest) {
      throw new Error(
        `manifest static property must be defined on ${this.constructor.name}`
      );
    }
    const path = `${MANIFEST_TEMPLATES_PATH}/${manifest}`;
    if (!fs.existsSync(path)) {
      throw new Error(`File ${path} does not exist`);
    }
    const content = fs.readFileSync(path, "utf8");
    return runSubstitution(content, this.getVars());
  }
}

function processCompositeTemplatesIndex() {
  let loaded = false;
  let compositeTemplates: Record<string, string[]> = {};

  function getCompositeTemplates() {
    if (!loaded) {
      const data = fs.readFileSync(COMPOSITE_TEMPLATES_INDEX_PATH, "utf8");
      try {
        compositeTemplates = yaml.parse(data);
      } catch (e) {
        throw new Error(`Error parsing ${COMPOSITE_TEMPLATES_INDEX_PATH}`);
      }
      loaded = true;
    }
    return compositeTemplates;
  }

  function getCompositeTemplateContent(entry: string) {
    const entryInFile = getCompositeTemplates()[entry];
    if (!entryInFile) {
      throw new Error(
        `Entry ${entry} not found in ${COMPOSITE_TEMPLATES_INDEX_PATH}`
      );
    }
    if (entryInFile.length === 0) {
      throw new Error(`Entry ${entry} has no files`);
    }
    return entryInFile.map((file) => {
      const path = `${MANIFEST_TEMPLATES_PATH}/${file}`;
      if (!fs.existsSync(path)) {
        throw new Error(`File ${file} not found in ${MANIFEST_TEMPLATES_PATH}`);
      }
      return fs.readFileSync(path, "utf8");
    });
  }

  return { getCompositeTemplateContent };
}
