import chalk from "chalk";
import { TemplateCopier } from "./libs/template-copier";
import fs from 'fs-extra'

const tc = new TemplateCopier()
tc.addFolder("lang-variants/python", "tmp/init-test");
tc.setFileOptions("tmp/init-test/pyproject.toml", { 
  enableSubstitution: true,  
});

tc.setFileOptions("tmp/init-test/.gitignore", {
  messageIfTargetExists: (fileInfo) => {
    const content = fs.readFileSync(fileInfo.sourceAbs, 'utf-8');
    return `add the following to your ${chalk.blue(".gitignore")}:
${chalk.yellow(content)}`;
  }
})

const messages = [
  `add the following entry to the main ${chalk.blue("package.json")}:
  ${chalk.yellow(`"workspaces": [
    "libs/**",
    "applications/**",
    "db/**",
    "dml/**"
  ],`)}`
]
tc.run({ messages, substitution: { 'PROJECT_NAME': 'test-project' } });