const { spawn, execFile } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const https = require("node:https");
const crypto = require("node:crypto");

const execFileAsync = promisify(execFile);

function download(url, dest, onData) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: { "User-Agent": "BrewStore/1.3.0", Accept: "*/*" },
      },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          download(res.headers.location, dest, onData).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        const hash = crypto.createHash("sha256");
        const out = require("node:fs").createWriteStream(dest);
        res.on("data", (chunk) => {
          hash.update(chunk);
          onData?.(".");
        });
        res.pipe(out);
        out.on("finish", () => resolve(hash.digest("hex")));
        out.on("error", reject);
      },
    );
    req.on("error", reject);
  });
}

async function findApp(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory() && ent.name === "BrewStore.app") return full;
    if (ent.isDirectory() && !ent.name.startsWith(".")) {
      const nested = await findApp(full).catch(() => null);
      if (nested) return nested;
    }
  }
  return null;
}

async function applyAppUpdate({ downloadUrl, expectedSha256, onData }) {
  if (!downloadUrl) throw new Error("No download URL on this release");
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "brewstore-update-"));
  const ext = /\.zip$/i.test(downloadUrl) ? "zip" : "dmg";
  const archive = path.join(tmp, `BrewStore-update.${ext}`);
  onData?.(`Downloading update…\n`);
  const sha = await download(downloadUrl, archive, onData);
  onData?.(`\nDownloaded (${sha.slice(0, 12)}…)\n`);
  if (expectedSha256 && sha.toLowerCase() !== String(expectedSha256).toLowerCase()) {
    throw new Error("Update checksum did not match");
  }

  let appPath = null;
  if (ext === "zip") {
    onData?.("Unpacking…\n");
    await execFileAsync("/usr/bin/ditto", ["-xk", archive, tmp]);
    appPath = await findApp(tmp);
  } else {
    onData?.("Mounting disk image…\n");
    const { stdout } = await execFileAsync("/usr/bin/hdiutil", [
      "attach",
      "-nobrowse",
      "-readonly",
      archive,
    ]);
    const mount = stdout
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .pop()
      ?.split(/\t/)
      .pop();
    try {
      appPath = mount ? await findApp(mount) : null;
    } finally {
      if (mount) {
        await execFileAsync("/usr/bin/hdiutil", ["detach", mount, "-quiet"]).catch(
          () => {},
        );
      }
    }
  }

  if (!appPath) throw new Error("BrewStore.app not found in the update archive");
  const dest = "/Applications/BrewStore.app";
  onData?.(`Installing to ${dest}…\n`);
  await execFileAsync("/usr/bin/ditto", [appPath, dest]);
  await execFileAsync("/usr/bin/xattr", ["-cr", dest]).catch(() => {});
  onData?.("Installed. Relaunching…\n");
  spawn("/usr/bin/open", ["-n", dest], { detached: true, stdio: "ignore" }).unref();
  return { ok: true, sha256: sha, dest };
}

module.exports = { applyAppUpdate };
