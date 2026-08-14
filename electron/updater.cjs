const { spawn, execFile } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const https = require("node:https");
const crypto = require("node:crypto");

const execFileAsync = promisify(execFile);
const DOWNLOAD_TIMEOUT_MS = 6 * 60 * 1000;

function download(url, dest, onData) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };

    const timer = setTimeout(() => {
      req.destroy();
      finish(reject, new Error("Download timed out"));
    }, DOWNLOAD_TIMEOUT_MS);

    const req = https.get(
      url,
      {
        headers: { "User-Agent": "BrewStore/1.3.2", Accept: "*/*" },
      },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          clearTimeout(timer);
          download(res.headers.location, dest, onData).then(
            (sha) => finish(resolve, sha),
            (err) => finish(reject, err),
          );
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          finish(reject, new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }
        const total = Number(res.headers["content-length"]) || 0;
        let received = 0;
        let lastPct = -1;
        const hash = crypto.createHash("sha256");
        const out = require("node:fs").createWriteStream(dest);
        res.on("data", (chunk) => {
          hash.update(chunk);
          received += chunk.length;
          if (!total) return;
          const pct = Math.min(99, Math.floor((received / total) * 100));
          if (pct !== lastPct && pct % 5 === 0) {
            lastPct = pct;
            onData?.(`Downloading update… ${pct}%\n`);
          }
        });
        res.pipe(out);
        out.on("finish", () => finish(resolve, hash.digest("hex")));
        out.on("error", (err) => finish(reject, err));
      },
    );
    req.on("error", (err) => finish(reject, err));
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

function writeInstaller(tmp, srcApp, destApp) {
  const script = `#!/bin/bash
set -euo pipefail
PID="$1"
SRC="$2"
DEST="$3"
for _ in $(seq 1 80); do
  if ! kill -0 "$PID" 2>/dev/null; then
    break
  fi
  sleep 0.25
done
sleep 0.5
/usr/bin/ditto "$SRC" "$DEST"
/usr/bin/xattr -cr "$DEST" >/dev/null 2>&1 || true
/usr/bin/open -n "$DEST"
`;
  return fs.writeFile(path.join(tmp, "install-update.sh"), script, { mode: 0o755 });
}

async function applyAppUpdate({ downloadUrl, expectedSha256, onData }) {
  if (!downloadUrl) throw new Error("No download URL on this release");
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "brewstore-update-"));
  const ext = /\.zip$/i.test(downloadUrl) ? "zip" : "dmg";
  const archive = path.join(tmp, `BrewStore-update.${ext}`);
  onData?.("Downloading update…\n");
  const sha = await download(downloadUrl, archive, onData);
  onData?.(`Downloaded (${sha.slice(0, 12)}…)\n`);
  if (expectedSha256 && sha.toLowerCase() !== String(expectedSha256).toLowerCase()) {
    throw new Error("Update checksum did not match");
  }

  let appPath = null;
  let mount = null;
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
    mount = stdout
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .pop()
      ?.split(/\t/)
      .pop();
    appPath = mount ? await findApp(mount) : null;
  }

  if (!appPath) throw new Error("BrewStore.app not found in the update archive");
  const dest = "/Applications/BrewStore.app";
  const staged = path.join(tmp, "BrewStore.app");
  if (path.resolve(appPath) !== path.resolve(staged)) {
    await execFileAsync("/usr/bin/ditto", [appPath, staged]);
    appPath = staged;
  }
  if (mount) {
    await execFileAsync("/usr/bin/hdiutil", ["detach", mount, "-quiet"]).catch(() => {});
  }

  onData?.("Quitting, then installing into Applications…\n");
  await writeInstaller(tmp, appPath, dest);
  spawn("/bin/bash", [path.join(tmp, "install-update.sh"), String(process.pid), appPath, dest], {
    detached: true,
    stdio: "ignore",
  }).unref();
  return { ok: true, sha256: sha, dest };
}

module.exports = { applyAppUpdate };
