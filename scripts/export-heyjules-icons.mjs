#!/usr/bin/env node

import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

const scriptDirectory = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const repositoryRoot = NodePath.resolve(scriptDirectory, "..");
const sourcePath = NodePath.join(repositoryRoot, "assets/heyjules/app-icon.svg");
const checkOnly = process.argv.includes("--check");
const temporaryRoot = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "heyjules-icons-"));

const run = (command, args) => {
  const result = NodeChildProcess.spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `${command} failed (${String(result.status)}): ${result.stderr || result.stdout}`.trim(),
    );
  }
};

const renderPng = (size, outputPath) => {
  run("magick", [
    "-background",
    "none",
    "-density",
    "192",
    sourcePath,
    "-resize",
    `${size}x${size}`,
    "-strip",
    outputPath,
  ]);
};

const temporaryMainPng = NodePath.join(temporaryRoot, "heyjules-1024.png");
const temporaryDesktopPng = NodePath.join(temporaryRoot, "heyjules-512.png");
const temporaryAppleTouchPng = NodePath.join(temporaryRoot, "heyjules-180.png");
const temporaryFavicon32Png = NodePath.join(temporaryRoot, "heyjules-32.png");
const temporaryFavicon16Png = NodePath.join(temporaryRoot, "heyjules-16.png");
const temporaryWindowsIco = NodePath.join(temporaryRoot, "heyjules-windows.ico");
const temporaryWebIco = NodePath.join(temporaryRoot, "heyjules-web.ico");
const temporaryIcns = NodePath.join(temporaryRoot, "heyjules.icns");

renderPng(1024, temporaryMainPng);
renderPng(512, temporaryDesktopPng);
renderPng(180, temporaryAppleTouchPng);
renderPng(32, temporaryFavicon32Png);
renderPng(16, temporaryFavicon16Png);
run("magick", [
  temporaryMainPng,
  "-define",
  "icon:auto-resize=256,128,64,48,32,16",
  temporaryWindowsIco,
]);
run("magick", [temporaryMainPng, "-define", "icon:auto-resize=32,16", temporaryWebIco]);

const iconsetPath = NodePath.join(temporaryRoot, "HeyJules.iconset");
NodeFS.mkdirSync(iconsetPath);
for (const size of [16, 32, 128, 256, 512]) {
  renderPng(size, NodePath.join(iconsetPath, `icon_${size}x${size}.png`));
  renderPng(size * 2, NodePath.join(iconsetPath, `icon_${size}x${size}@2x.png`));
}
run("iconutil", ["-c", "icns", iconsetPath, "-o", temporaryIcns]);

const outputs = [
  [temporaryMainPng, "assets/heyjules/heyjules-ios-1024.png"],
  [temporaryMainPng, "assets/heyjules/heyjules-macos-1024.png"],
  [temporaryMainPng, "assets/heyjules/heyjules-universal-1024.png"],
  [temporaryWindowsIco, "assets/heyjules/heyjules-windows.ico"],
  [temporaryWebIco, "assets/heyjules/heyjules-web-favicon.ico"],
  [temporaryFavicon16Png, "assets/heyjules/heyjules-web-favicon-16x16.png"],
  [temporaryFavicon32Png, "assets/heyjules/heyjules-web-favicon-32x32.png"],
  [temporaryAppleTouchPng, "assets/heyjules/heyjules-web-apple-touch-180.png"],
  [temporaryDesktopPng, "apps/desktop/resources/icon.png"],
  [temporaryWindowsIco, "apps/desktop/resources/icon.ico"],
  [temporaryIcns, "apps/desktop/resources/icon.icns"],
  [temporaryWebIco, "apps/web/public/favicon.ico"],
  [temporaryFavicon16Png, "apps/web/public/favicon-16x16.png"],
  [temporaryFavicon32Png, "apps/web/public/favicon-32x32.png"],
  [temporaryAppleTouchPng, "apps/web/public/apple-touch-icon.png"],
];

const stale = [];
for (const [temporaryPath, relativeTargetPath] of outputs) {
  const targetPath = NodePath.join(repositoryRoot, relativeTargetPath);
  if (checkOnly) {
    if (
      !NodeFS.existsSync(targetPath) ||
      !NodeFS.readFileSync(temporaryPath).equals(NodeFS.readFileSync(targetPath))
    ) {
      stale.push(relativeTargetPath);
    }
    continue;
  }
  NodeFS.mkdirSync(NodePath.dirname(targetPath), { recursive: true });
  NodeFS.copyFileSync(temporaryPath, targetPath);
}

NodeFS.rmSync(temporaryRoot, { recursive: true, force: true });

if (stale.length > 0) {
  throw new Error(
    `Generated HeyJules icon assets are stale:\n${stale.map((path) => `- ${path}`).join("\n")}`,
  );
}

console.log(checkOnly ? "HeyJules icon assets are current." : "Exported HeyJules icon assets.");
