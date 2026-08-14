const { spawn, execFile } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const execFileAsync = promisify(execFile);
const DOWNLOAD_TIMEOUT_MS = 8 * 60 * 1000;

function curlDownload(url, dest, onData) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      finish(reject, new Error("Download timed out"));
    }, DOWNLOAD_TIMEOUT_MS);

    const proc = spawn(
      "/usr/bin/curl",
      ["-fL", "--retry", "3", "--retry-delay", "2", "-o", dest, url],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    proc.stderr.on("data", (chunk) => {
      const line = String(chunk).trim();
      if (!line) return;
      if (/%/.test(line)) onData?.(`${line}\n`);
    });

    proc.on("error", (err) => finish(reject, err));
    proc.on("close", (code) => {
      if (code === 0) finish(resolve, undefined);
      else finish(reject, new Error(`Download failed (curl exit ${code})`));
    });
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

async function writeInstallScript(tmp, srcApp, parentPid) {
  const scriptPath = path.join(tmp, "install-update.sh");
  const script = `#!/bin/bash
set -euo pipefail
SRC="$1"
DEST="/Applications/BrewStore.app"
PID="$2"
LOG="$(dirname "$0")/update.log"
log() { echo "$(date '+%H:%M:%S') $*" >> "$LOG"; }
log "Waiting for BrewStore (pid $PID) to quit"
for _ in \$(seq 1 160); do
  kill -0 "$PID" 2>/dev/null || break
  sleep 0.25
done
sleep 1
log "Installing to $DEST"
/usr/bin/ditto "$SRC" "$DEST"
/usr/bin/xattr -cr "$DEST" >/dev/null 2>&1 || true
log "Launching BrewStore"
/usr/bin/open -n "$DEST"
log "Done"
`;
  await fs.writeFile(scriptPath, script, { mode: 0o755 });
  return scriptPath;
}

async function applyAppUpdate({ downloadUrl, expectedSha256, onData }) {
  if (!downloadUrl) throw new Error("No download URL on this release");

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "brewstore-update-"));
  const ext = /\.zip$/i.test(downloadUrl) ? "zip" : "dmg";
  const archive = path.join(tmp, `BrewStore-update.${ext}`);

  onData?.("Downloading update…\n");
  await curlDownload(downloadUrl, archive, onData);
  onData?.("Download complete.\n");

  if (expectedSha256) {
    const { stdout } = await execFileAsync("/usr/bin/shasum", ["-a", "256", archive]);
    const sha = String(stdout).trim().split(/\s+/)[0];
    if (sha.toLowerCase() !== String(expectedSha256).toLowerCase()) {
      throw new Error("Update checksum did not match");
    }
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

  const staged = path.join(tmp, "BrewStore.app");
  if (path.resolve(appPath) !== path.resolve(staged)) {
    onData?.("Staging update…\n");
    await execFileAsync("/usr/bin/ditto", [appPath, staged]);
    appPath = staged;
  }
  if (mount) {
    await execFileAsync("/usr/bin/hdiutil", ["detach", mount, "-quiet"]).catch(() => {});
  }

  onData?.("Quitting BrewStore to install into Applications…\n");
  const scriptPath = await writeInstallScript(tmp, appPath, process.pid);
  spawn("/bin/bash", [scriptPath, appPath, String(process.pid)], {
    detached: true,
    stdio: "ignore",
  }).unref();

  return { ok: true };
}

module.exports = { applyAppUpdate };
