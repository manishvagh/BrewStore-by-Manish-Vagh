#!/usr/bin/env node
/**
 * Build BrewStore, install to /Applications, and ensure Homebrew is present.
 * Homebrew setup uses a macOS password dialog (no Terminal.app).
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const brew = require("../electron/brew.cjs");

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      shell: opts.shell || false,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "", ...opts.env },
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`));
    });
  });
}

function findBuiltApp() {
  const release = path.join(__dirname, "..", "release");
  const matches = fs
    .readdirSync(release, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("mac"))
    .map((d) => path.join(release, d.name, "BrewStore.app"))
    .filter((p) => fs.existsSync(p));
  if (!matches.length) {
    throw new Error("Built BrewStore.app not found under release/");
  }
  return matches[0];
}

async function main() {
  console.log("→ Building BrewStore…");
  await run("npm", ["run", "dist"], { shell: process.platform === "win32" });

  const src = findBuiltApp();
  const dest = "/Applications/BrewStore.app";
  console.log(`→ Installing ${src} → ${dest}`);
  await run("rm", ["-rf", dest]);
  await run("cp", ["-R", src, dest]);
  await run("xattr", ["-cr", dest]).catch(() => {});

  console.log("→ Checking Homebrew…");
  let status = await brew.probeBrew();
  if (status.installed) {
    console.log(`✓ Homebrew ready (${status.version})`);
  } else {
    console.log("→ Homebrew not found — installing as part of BrewStore setup…");
    console.log("  (macOS may ask for your password)");
    await brew.installHomebrew((text) => {
      process.stdout.write(text);
    });
    status = await brew.probeBrew();
    if (!status.installed) {
      throw new Error("Homebrew install finished but brew was not detected.");
    }
    console.log(`✓ Homebrew ready (${status.version})`);
  }

  console.log("✓ BrewStore installed to /Applications");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
