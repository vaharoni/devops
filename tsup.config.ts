import { defineConfig } from "tsup";
import { cp } from "fs/promises";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    plugins: "src/plugins.ts",
    devops: "src/devops.ts",
  },
  format: ["esm"],
  dts: true,
  splitting: true,
  clean: true,
  outDir: "dist",
  target: "esnext",
  // Copy non-JS assets after build
  onSuccess: async () => {
    await Promise.all([
      cp("src/cli/exec.sh", "dist/cli/exec.sh", { recursive: true }),
      cp("src/target-templates", "dist/src/target-templates", { recursive: true }),
    ]);
    console.log("Copied exec.sh to dist/cli/");
    console.log("Copied target-templates to dist/src/target-templates/");
  },
});
