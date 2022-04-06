/// <reference types="jest-extended" />

import { firefox } from "playwright";

import * as vite from "vite";
import type { RollupOutput } from "rollup";
import vitePluginLegacy from "@vitejs/plugin-legacy";
import vitePluginPublicPath from "../src";

import express from "express";
import mime from "mime";
import type { AddressInfo } from "net";

const excludeFilter = /^(https:).*systemjs/;

async function build() {
  const result = await vite.build({
    root: __dirname,
    base: "/__vite_base__/",
    plugins: [
      vitePluginLegacy(),
      vitePluginPublicPath({
        publicPathExpression: "window.publicPath",
        html: true,
        excludeScripts: excludeFilter
      })
    ],
    logLevel: "error"
  });

  if ("close" in result) {
    throw new TypeError("Internal error in Vite");
  }

  return "output" in result ? result : <RollupOutput>{ output: result.flatMap(({ output }) => output) };
}

/**
 * Listen on two ports. Simulating two hosts (one for original host, i.e. serving `index.html`,
 * the other for dynamic public path).
 */
async function startServers(
  buildResult: RollupOutput,
  accessCallback: (serverId: number, filePath: string, fileContent: string | Uint8Array) => string | Uint8Array
): Promise<[string, string]> {
  const app = express();
  let ports: [number, number] = [0, 0];

  const bundle = Object.fromEntries(
    buildResult.output.map(item => [item.fileName, item.type === "chunk" ? item.code : item.source])
  );

  app.use((req, res) => {
    // Remove leading "/"
    const filePath = (req.path === "/" ? "/index.html" : req.path).slice(1);
    const port = req.socket.localPort;

    if (filePath in bundle) {
      const data = accessCallback(ports.indexOf(port), filePath, bundle[filePath]);
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Methods", "*");
      const contentType = mime.lookup(filePath);
      const contentTypeWithEncoding = contentType + (contentType.includes("text/") ? "; charset=utf-8" : "");
      res.contentType(contentTypeWithEncoding);
      res.send(data);
    } else {
      accessCallback(ports.indexOf(port), filePath, "");
      res.status(404).end();
    }
  });

  const listen = async () =>
    await new Promise<number>(resolve => {
      const server = app.listen(0, "127.0.0.1", () => resolve((server.address() as AddressInfo).port));
    });

  ports[0] = await listen();
  ports[1] = await listen();

  return ports.map(port => `http://127.0.0.1:${port}/`) as [string, string];
}

async function createBrowser(modernBrowser: boolean) {
  return await firefox.launch({
    firefoxUserPrefs: {
      // Simulate a legacy browser with ES modules support disabled
      "dom.moduleScripts.enabled": modernBrowser
    }
  });
}

async function runTest(modernBrowser: boolean) {
  enum Server {
    Origin = 0,
    Dynamic = 1
  }

  const buildResult = await build();
  const servers = await startServers(buildResult, (serverId, filePath, fileContent) => {
    // Browser should load only `index.html` from the origin server
    if (serverId === Server.Origin) {
      expect(filePath).toBeOneOf(["index.html", "favicon.ico"]);
    }

    // Replace the dynamic public path value in `index.html`
    if (filePath === "index.html") {
      return (fileContent as string).replace("__public_path__", JSON.stringify(servers[Server.Dynamic]));
    }

    return fileContent;
  });

  const browser = await createBrowser(modernBrowser);
  const page = await browser.newPage();

  page.goto(servers[Server.Origin]);

  const expectedLog = `PASS! (modernBrowser = ${modernBrowser})`;
  const expectedLogPrefix = "PASS!";
  const foundLog = await new Promise<string>((resolve, reject) => {
    // Expect no errors
    page.on("pageerror", reject);

    page.on("console", async message => {
      // Expect no errors from console
      if (message.type() === "error") {
        reject(new Error("Error message from browser console: " + message.text()));
      }

      // Expect the log (see `src/content.ts`)
      if (message.type() === "log" && message.text().startsWith(expectedLogPrefix)) {
        resolve(message.text());
      }
    });
  });
  
  const excludedScriptTag = await page.$("script[src]");
  expect(excludedScriptTag).not.toBeNull();

  const srcAtttibute = await excludedScriptTag.getAttribute("src");
  expect(excludeFilter.test(srcAtttibute)).toBeTrue();

  expect(foundLog).toEqual(expectedLog);
}

jest.setTimeout(30000);

describe("E2E test for a modern-legacy build", () => {
  it("should work on modern browser", async () => {
    await runTest(true);
  });

  it("should work on legacy browser", async () => {
    await runTest(false);
  });
});
