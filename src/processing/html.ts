import { parse } from "node-html-parser";
import serialize from "serialize-javascript";

import { ViteConfig, Options } from "..";

export function processHtml(config: ViteConfig, options: Options, _fileName: string, html: string) {
  // Just load from a static base
  if (typeof options.html === "string") {
    return html.split(config.base).join(options.html);
  }

  // Disable HTML processing and pass-through the HTML with base placeholder for manual processing
  if (!options.html) {
    return html;
  }

  const document = parse(html, { comment: true });

  // For simple substitution, firstly inject placeholders and required code
  const htmlOptions =
    typeof options.html === "object"
      ? options.html
      : {
          functionNameAddLinkTag: "__vitePluginPublicPath_addLinkTag",
          addLinkTagsPlaceholder: `__add_link_tags_${Math.random()}__`,
          functionNameAddScriptTag: "__vitePluginPublicPath_addScriptTag",
          addScriptTagsPlaceholder: `__add_script_tags_${Math.random()}__`
        };
  if (typeof options.html !== "object") {
    // Ignore
    const lastScriptInHead = document.querySelectorAll("head > script:not([type=module])").pop();
    /* istanbul ignore next */
    if (!lastScriptInHead) {
      throw new Error(
        `Couldn't find any <script> tags in your <head>. Please initialize your public path expression (${options.publicPathExpression}) in a <script> in your <head>.`
      );
    }

    lastScriptInHead.insertAdjacentHTML(
      "afterend",
      "\n" +
        "<script>\n" +
        "  (function () {\n" +
        `    function ${htmlOptions.functionNameAddLinkTag}(rel, href) {\n` +
        '      var link = document.createElement("link");\n' +
        "      link.rel = rel;\n" +
        "      link.href = href;\n" +
        "      document.head.appendChild(link);\n" +
        "    }\n" +
        `    ${htmlOptions.addLinkTagsPlaceholder}\n` +
        "  })();\n" +
        "</script>\n"
    );

    document
      .querySelector("body")
      .insertAdjacentHTML(
        "beforeend",
        "\n" +
          "<script>\n" +
          "  (function () {\n" +
          `    function ${htmlOptions.functionNameAddScriptTag}(attributes, inlineScriptCode) {\n` +
          '      var script = document.createElement("script");\n' +
          "      if (attributes) for (var key in attributes) script.setAttribute(key, attributes[key]);\n" +
          "      script.async = false;\n" +
          '      if (inlineScriptCode) script.src = "data:text/javascript," + inlineScriptCode;\n' +
          "      document.body.appendChild(script);\n" +
          "    }\n" +
          `    ${htmlOptions.addScriptTagsPlaceholder}\n` +
          "  })();\n" +
          "</script>\n"
      );
  }

  const urlPrefix = config.base;
  const normalizeUrl = (url: string) => {
    if (url.startsWith(urlPrefix)) url = url.slice(urlPrefix.length);
    return url;
  };

  const linkTags = document
    .querySelectorAll("link[rel]")
    .filter(link => link.getAttribute("href").startsWith(urlPrefix));
  const addLinkTagsCode = linkTags
    .map(tag => {
      const href = normalizeUrl(tag.getAttribute("href"));
      const rel = tag.getAttribute("rel");
      return `${htmlOptions.functionNameAddLinkTag}(${serialize(rel)}, ${options.publicPathExpression} + ${serialize(
        href
      )})`;
    })
    .join(";");

  const scriptTags = document.querySelectorAll("script[src], script[nomodule]")
    .filter(tag => tag.attributes["data-external"] === undefined);

  const addScriptTagsCode = scriptTags
    .map(tag => {
      const patchAttributes = ["src", "data-src"];
      const args = [
        "{ " +
          Object.entries(tag.attributes)
            .map(
              ([key, value]) =>
                serialize(key) +
                ": " +
                (patchAttributes.includes(key)
                  ? `${options.publicPathExpression} + ${serialize(normalizeUrl(value))}`
                  : serialize(value))
            )
            .join(", ") +
          " }",
        tag.innerHTML.trim() ? serialize(tag.innerHTML.trim()) : null
      ];
      return `${htmlOptions.functionNameAddScriptTag}(${args.filter(arg => arg != null).join(", ")})`;
    })
    .join(";");

  [...linkTags, ...scriptTags].map(tag => tag.parentNode.removeChild(tag));

  return document.outerHTML
    .replace(htmlOptions.addLinkTagsPlaceholder, addLinkTagsCode)
    .replace(htmlOptions.addScriptTagsPlaceholder, addScriptTagsCode);
}
