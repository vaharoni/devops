/**
 * This module provides the package root directory path.
 * 
 * It must be at the root of the src/ directory so that when bundled with tsup,
 * the import.meta.url resolves to the dist/ directory correctly.
 * 
 * All files that need to reference paths relative to the package root should
 * import pkgRoot from this module instead of using import.meta.url directly.
 */
import url from "url";
import path from "path";

const __file__ = url.fileURLToPath(import.meta.url);
export const pkgRoot = path.dirname(__file__);
