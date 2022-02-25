import { ViteConfig, Options } from "..";
import { replaceStringWithExpression } from "../utils/replacer";

/**
 * Modern build of JS files import other chunks with relative path, but preload dependencies
 * and load CSS files with root-relative paths.
 *
 * Legacy build of JS files import other chunks with root-relative paths and embedding CSS files
 * in JS code. The root-relative URLs in embedded CSS files could be hard to replace.
 *
 * So we replace them with SWC's AST traversal.
 */
export async function processCode(config: ViteConfig, options: Options, _fileName: string, code: string) {
  if (!code.includes(config.base)) return code;

  return await replaceStringWithExpression(code, config.base, options.publicPathExpression, !!config.build.minify);
}
