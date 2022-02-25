import { ViteConfig, Options } from "..";

/**
 * For CSS and other some possible assets, which may reference other assets with URLs
 * replace the root-relative URLs with relative URLs.
 */
export function processAsset(config: ViteConfig, _options: Options, filename: string, content: string) {
  const assetsPrefix = config.base + config.build.assetsDir + "/";

  if (!content.includes(assetsPrefix)) {
    /* istanbul ignore next */
    if (content.includes(config.base)) {
      throw new Error(
        `Unexpected error. Detected base placeholder but not base placeholder + assets dir. Couldn't determine relative URL. In file: ${filename}\n` +
          "Please open an issue at https://github.com/Menci/vite-plugin-public-path/issues"
      );
    }

    return content;
  }

  return content.split(assetsPrefix).join("");
}
