import url from "url";
import path from "path";
import fs from "fs-extra";

const __file__ = url.fileURLToPath(import.meta.url);
const __root__ = path.join(path.dirname(__file__), "../..");
const templatesDir = path.join(__root__, "src/target-templates");
const targetDir = process.cwd(); // User's current working directory

console.log(`Initializing devops files from ${templatesDir} to ${targetDir}`);

async function copyTemplates() {
  try {
    // Copy files without overriding existing ones
    await fs.copy(templatesDir, targetDir, {
      overwrite: false,
      errorOnExist: false,
      dereference: false
    });
    
    console.log("✅ Devops files initialized successfully!");
    console.log("Note: Existing files were not overwritten.");
  } catch (error) {
    console.error("❌ Failed to initialize devops files:", error);
    process.exit(1);
  }
}

copyTemplates();
