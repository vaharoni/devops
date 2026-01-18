import path from "path";
import fs from "fs-extra";
import chalk from "chalk";
import fg from 'fast-glob';
import { pkgRoot } from "../pkg-root";

const templatesDir = path.join(pkgRoot, "src/target-templates");
const targetDir = process.cwd(); // User's current working directory

type MessageGeneratorFn = (targetExists: boolean, fileInfo: InitGeneratorFileInfo) => string | null | undefined;

type CommonFileInfo = {
  targetRel: string;
  targetAbs: string;
  targetFolderAbs: string;
  targetExists: boolean;
  messageGenerator?: MessageGeneratorFn;
}

export type InitGeneratorCopiedFileInfo = CommonFileInfo &{
  type: "copied";
  sourceRel: string;
  sourceAbs: string;
  enableSubstitution?: boolean;
}

type InitGeneratorGeneratedFileInfo = CommonFileInfo & {
  type: "generated";
  content: string;
}

export type InitGeneratorFileInfo = InitGeneratorCopiedFileInfo | InitGeneratorGeneratedFileInfo;

export class InitGenerator {
  projectName?: string;

  /** The key is targetRel */
  files: Record<string, InitGeneratorFileInfo> = {};

  constructor() {
    if (fs.existsSync("package.json")) {
      const packageJson = fs.readJSONSync("package.json");
      this.projectName = packageJson.name;
    }
  }

  _ensureFileExists(targetRel: string) {
    if (!this.files[targetRel]) {
      throw new Error(`File for target "${targetRel}" not found.`);
    }
  }

  enableSubtitution(targetRel: string) {
    this._ensureFileExists(targetRel);
    if (this.files[targetRel].type !== "copied") {
      throw new Error(`File for target "${targetRel}" is not a copied file.`);
    }
    this.files[targetRel].enableSubstitution = true;
  }

  setMessageGenerator(targetRel: string, messageGen: MessageGeneratorFn) {
    this._ensureFileExists(targetRel);
    this.files[targetRel].messageGenerator = messageGen;
  }

  addGeneratedFile(targetRel: string, content: string) {
    const targetAbs = path.join(targetDir, targetRel);
    const targetFolderAbs = path.dirname(targetAbs);
    const exists = fs.existsSync(targetAbs);
    this.files[targetRel] = {
      type: "generated",
      targetRel,
      targetAbs,
      targetFolderAbs,
      targetExists: exists,
      content,
    };
  }

  /**
   * @param source relative path under the templates folder. All files and folders under `source` are copied directly under `target`.
   * @param target relative path under the project root folder.
   * If the target file exists already in `files`, it will be overridden.
   */
  addCopiedFolder(source: string, target: string) {
    const pathPrefix = path.join(templatesDir, source);
    const glob = path.join(pathPrefix, '**/*');
    fg.globSync(glob, { dot: true }).forEach((sourceAbs) => {
      const sourceRel = path.relative(templatesDir, sourceAbs);
      const pathUnderSource = path.relative(pathPrefix, sourceAbs);
      const targetRel = path.join(target, pathUnderSource);
      const targetAbs = path.join(targetDir, targetRel);
      const targetFolderAbs = path.dirname(targetAbs);
      const exists = fs.existsSync(targetAbs);
      this.files[targetRel] = {
        type: "copied",
        sourceRel,
        targetRel,
        sourceAbs,
        targetAbs,
        targetFolderAbs,
        targetExists: exists,
      };
    })
  }

  run({ 
    substitution = {}, 
    messages = [],
  } : { 
    substitution?: Record<string, string | undefined>; 
    messages?: string[];
  }) {
    const fileMessages: string[] = [];
    Object.values(this.files).forEach((fileInfo) => {
      if (fileInfo.messageGenerator) {
        const message = fileInfo.messageGenerator(fileInfo.targetExists, fileInfo);
        if (message) {
          fileMessages.push(message);
        }
      }

      if (fileInfo.targetExists) {
        console.log(`Skipped ${chalk.yellow(fileInfo.targetRel)} (exists)`);
        return;
      } 

      // Create or copy
      if (!fs.existsSync(fileInfo.targetFolderAbs)) {
        fs.mkdirSync(fileInfo.targetFolderAbs, { recursive: true });
      }

      if (fileInfo.type === 'generated') {
        fs.writeFileSync(fileInfo.targetAbs, fileInfo.content, 'utf8');
      } else if (fileInfo.enableSubstitution) {
        const content = fs.readFileSync(fileInfo.sourceAbs, 'utf8');
        const substitutedContent = content.replace(/\$([A-Z_]+)/g, (_, varName) => {
          const value = substitution[varName];
          if (!value) {
            throw new Error(`${chalk.blue("TemplateCopier.run()")}: Variable ${chalk.yellow(varName)} is needed by ${chalk.yellow(fileInfo.targetRel)} but is undefined.`);
          }
          return value;
        });
        fs.writeFileSync(fileInfo.targetAbs, substitutedContent);
      } else {
        fs.copySync(fileInfo.sourceAbs, fileInfo.targetAbs, {
          overwrite: false,
          errorOnExist: false,
          dereference: false,
        });
      }
      console.log(`Created ${chalk.green(fileInfo.targetRel)}`);
    });

    const allMessages = [...messages, ...fileMessages];
    if (!allMessages.length) return;

    console.log(chalk.blue("\nNext steps:"));
    allMessages.forEach((msg, i) => {
      console.log(`${i + 1}. ${msg}\n`);
    });
  }
}
