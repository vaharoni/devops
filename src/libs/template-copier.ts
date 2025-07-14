import url from "url";
import path from "path";
import fs from "fs-extra";
import chalk from "chalk";
import fg from 'fast-glob';

const __file__ = url.fileURLToPath(import.meta.url);
const __root__ = path.join(path.dirname(__file__), "../..");
const templatesDir = path.join(__root__, "src/target-templates");
const targetDir = process.cwd(); // User's current working directory

type FileOptions = {
  enableSubstitution?: boolean;
  messageIfTargetExists?: string | ((fileInfo: FileInfo) => string);
}

type FileInfo = FileOptions & {
  sourceRel: string;
  targetRel: string;
  sourceAbs: string;
  targetAbs: string;
  targetFolderAbs: string;
  targetExists: boolean;
}

export class TemplateCopier {
  /** The key is targetRel */
  files: Record<string, FileInfo> = {};

  setFileOptions(targetRel: string, opts: FileOptions) {
    if (!this.files[targetRel]) {
      throw new Error(`File for target "${targetRel}" not found.`);
    }
    this.files[targetRel] = { ...this.files[targetRel], ...opts };
  }

  /**
   * @param source relative path under the templates folder. All files and folders under `source` are copied directly under `target`.
   * @param target relative path under the project root folder.
   * If the target file exists already in `files`, it will be overridden.
   */
  addFolder(source: string, target: string) {
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
        sourceRel,
        targetRel,
        sourceAbs,
        targetAbs,
        targetFolderAbs,
        targetExists: exists,
      };
    })
  }

  dryRun() {
    Object.values(this.files).forEach((fileInfo) => {
      if (fileInfo.targetExists) {
        console.log(`Will skip ${chalk.yellow(fileInfo.targetRel)} (exists)`);
      } else {
        if (fileInfo.enableSubstitution) {
          console.log(`Will copy ${chalk.yellow(fileInfo.sourceRel)} to ${chalk.yellow(fileInfo.targetRel)} with substitution`);
        } else {
          console.log(`Will copy ${chalk.yellow(fileInfo.sourceRel)} to ${chalk.yellow(fileInfo.targetRel)} as is`);
        }
      }
    })
    console.log("\n");
    Object.values(this.files).forEach((fileInfo) => {
      if (fileInfo.targetExists && fileInfo.messageIfTargetExists) {
        console.log(fileInfo.messageIfTargetExists);
      }
    });
  }

  run({ 
    substitution = {}, 
    messages = [],
  } : { 
    substitution?: Record<string, string>; 
    messages?: string[];
  }) {
    const fileMessages: string[] = [];
    Object.values(this.files).forEach((fileInfo) => {
      if (fileInfo.targetExists) {
        console.log(`Skipped ${chalk.yellow(fileInfo.targetRel)} (exists)`);
        const messageGenerator = fileInfo.messageIfTargetExists;
        if (messageGenerator) {
          if (typeof messageGenerator === 'function') {
            fileMessages.push(messageGenerator(fileInfo));
          } else {
            fileMessages.push(messageGenerator);
          }
        }
        return;
      } 

      // Create or copy
      if (!fs.existsSync(fileInfo.targetFolderAbs)) {
        fs.mkdirSync(fileInfo.targetFolderAbs, { recursive: true });
      }

      if (fileInfo.enableSubstitution) {
        const content = fs.readFileSync(fileInfo.sourceAbs, 'utf8');
        const substitutedContent = content.replace(/\$([A-Z_]+)/g, (_, varName) => {
          const value = substitution[varName];
          if (value === undefined) {
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
