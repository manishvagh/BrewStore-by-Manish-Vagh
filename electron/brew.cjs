const { spawn, execFile } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs/promises");
const path = require("node:path");
const https = require("node:https");

const execFileAsync = promisify(execFile);

const BREW_CANDIDATES = [
  "/opt/homebrew/bin/brew",
  "/usr/local/bin/brew",
  "brew",
];

const CASK_API = "https://formulae.brew.sh/api/cask.json";
const FORMULA_API = "https://formulae.brew.sh/api/formula.json";
const CATALOG_TTL_MS = 1000 * 60 * 60 * 12;

const BREW_INSTALL_SCRIPT =
  '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';
const BREW_SITE = "https://brew.sh";

async function findBrewPath() {
  for (const candidate of BREW_CANDIDATES) {
    try {
      if (candidate === "brew") {
        await execFileAsync("brew", ["--version"]);
        return "brew";
      }
      await fs.access(candidate);
      // Confirm the binary actually runs (stale path / broken install).
      await execFileAsync(candidate, ["--version"]);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

async function resolveBrew() {
  const brewPath = await findBrewPath();
  if (!brewPath) {
    const err = new Error("Homebrew is not installed");
    err.code = "BREW_NOT_FOUND";
    throw err;
  }
  return brewPath;
}

async function probeBrew() {
  const brewPath = await findBrewPath();
  if (!brewPath) {
    return {
      installed: false,
      code: "BREW_NOT_FOUND",
      installCommand: BREW_INSTALL_SCRIPT,
      brewSite: BREW_SITE,
    };
  }
  try {
    const { stdout } = await runBrew(brewPath, ["--version"]);
    return {
      installed: true,
      brewPath,
      version: stdout.trim().split("\n")[0] || "Homebrew",
      installCommand: BREW_INSTALL_SCRIPT,
      brewSite: BREW_SITE,
    };
  } catch {
    return {
      installed: false,
      code: "BREW_NOT_FOUND",
      installCommand: BREW_INSTALL_SCRIPT,
      brewSite: BREW_SITE,
    };
  }
}

async function writeAskPassHelper(dir) {
  const askPassPath = path.join(dir, "brewstore-askpass");
  const sudoShimPath = path.join(dir, "sudo");
  const askPassScript = `#!/bin/bash
osascript <<'APPLESCRIPT'
set answer to display dialog "BrewStore needs your Mac password to finish setup and install Homebrew." with title "BrewStore Setup" default answer "" with hidden answer with icon caution buttons {"Cancel", "OK"} default button "OK"
if button returned of answer is "Cancel" then error number -128
return text returned of answer
APPLESCRIPT
`;
  const sudoShim = `#!/bin/bash
exec /usr/bin/sudo -A "$@"
`;
  await fs.writeFile(askPassPath, askPassScript, { mode: 0o700 });
  await fs.writeFile(sudoShimPath, sudoShim, { mode: 0o700 });
  return { askPassPath, sudoShimPath, binDir: dir };
}

let homebrewInstallInFlight = null;

async function installHomebrew(onData) {
  if (homebrewInstallInFlight) {
    return homebrewInstallInFlight;
  }

  homebrewInstallInFlight = (async () => {
    const existing = await findBrewPath();
    if (existing) {
      onData?.("Homebrew is already installed.\n");
      return { ok: true, alreadyInstalled: true };
    }

    const tmpDir = await fs.mkdtemp(
      path.join(require("node:os").tmpdir(), "brewstore-setup-"),
    );
    const { askPassPath, binDir } = await writeAskPassHelper(tmpDir);

    onData?.("Setting up Homebrew…\n");
    onData?.("macOS may ask for your password.\n");

    try {
      await new Promise((resolve, reject) => {
        const child = spawn(
          "/bin/bash",
          [
            "-c",
            "curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh | /bin/bash",
          ],
          {
            env: {
              ...process.env,
              PATH: `${binDir}:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin`,
              SUDO_ASKPASS: askPassPath,
              NONINTERACTIVE: "1",
              CI: "1",
              HOMEBREW_NO_ANALYTICS: "1",
              HOMEBREW_NO_AUTO_UPDATE: "1",
              HOMEBREW_COLOR: "0",
            },
          },
        );

        child.stdout.on("data", (chunk) => onData?.(chunk.toString()));
        child.stderr.on("data", (chunk) => onData?.(chunk.toString()));
        child.on("error", reject);
        child.on("close", (code) => {
          if (code === 0) {
            resolve();
            return;
          }
          reject(
            new Error(
              code === 1
                ? "Homebrew setup didn’t finish. Check the log, then try again."
                : `Homebrew setup exited with code ${code}`,
            ),
          );
        });
      });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }

    const brewPath = await findBrewPath();
    if (!brewPath) {
      throw new Error(
        "Homebrew finished but brew was not found yet. Quit BrewStore and open it again.",
      );
    }

    onData?.("Homebrew is ready.\n");
    return { ok: true, brewPath };
  })().finally(() => {
    homebrewInstallInFlight = null;
  });

  return homebrewInstallInFlight;
}

function runBrew(brewPath, args, { onData } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(brewPath, args, {
      env: {
        ...process.env,
        HOMEBREW_NO_AUTO_UPDATE: "1",
        HOMEBREW_NO_ENV_HINTS: "1",
        HOMEBREW_COLOR: "0",
      },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      onData?.(text, "stdout");
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      onData?.(text, "stderr");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const err = new Error(
        stderr.trim() || stdout.trim() || `brew exited ${code}`,
      );
      err.code = code;
      err.stdout = stdout;
      err.stderr = stderr;
      reject(err);
    });
  });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "BrewStore/1.0" } }, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          fetchJson(res.headers.location).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to fetch ${url}: HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", reject);
  });
}

function extractAppNames(cask) {
  const names = new Set();
  for (const artifact of cask.artifacts || []) {
    if (!artifact || typeof artifact !== "object") continue;
    const appField = artifact.app;
    if (typeof appField === "string") {
      names.add(appField.endsWith(".app") ? appField : `${appField}.app`);
    } else if (Array.isArray(appField)) {
      for (const entry of appField) {
        if (typeof entry === "string") {
          names.add(entry.endsWith(".app") ? entry : `${entry}.app`);
        }
      }
    }
    if (typeof artifact.target === "string" && artifact.target.endsWith(".app")) {
      names.add(path.basename(artifact.target));
    }
  }
  return [...names];
}

function normalizeCask(cask) {
  const name = Array.isArray(cask.name) ? cask.name[0] : cask.name || cask.token;
  return {
    id: cask.token,
    token: cask.token,
    name,
    desc: cask.desc || "",
    homepage: cask.homepage || "",
    version: cask.version || "",
    tap: cask.tap || "homebrew/cask",
    type: "cask",
    license: null,
    appNames: extractAppNames(cask),
    urls: {
      stable: cask.url || null,
      head: null,
    },
    outdated: Boolean(cask.outdated),
    installed: Boolean(cask.installed),
  };
}

function normalizeFormula(formula) {
  return {
    id: formula.name,
    token: formula.name,
    name: formula.name,
    desc: formula.desc || "",
    homepage: formula.homepage || "",
    version: formula.versions?.stable || formula.version || "",
    tap: formula.tap || "homebrew/core",
    type: "formula",
    license: formula.license || null,
    appNames: [],
    urls: {
      stable: formula.urls?.stable?.url || null,
      head: formula.urls?.head?.url || null,
    },
    outdated: Boolean(formula.outdated),
    installed: Boolean(formula.installed?.length),
  };
}

async function readCache(cachePath) {
  try {
    const data = JSON.parse(await fs.readFile(cachePath, "utf8"));
    if (data?.cachedAt && Date.now() - data.cachedAt < CATALOG_TTL_MS) {
      return data;
    }
  } catch {
    return null;
  }
  return null;
}

async function writeCache(cachePath, data) {
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, JSON.stringify(data));
}

async function loadCatalog(userDataPath, { force = false } = {}) {
  const cachePath = path.join(userDataPath, "catalog-cache-v2.json");
  if (!force) {
    const cached = await readCache(cachePath);
    if (cached) return cached;
  }

  const [casksRaw, formulaeRaw] = await Promise.all([
    fetchJson(CASK_API),
    fetchJson(FORMULA_API),
  ]);

  const packages = [
    ...casksRaw.map(normalizeCask),
    ...formulaeRaw.map(normalizeFormula),
  ];

  const payload = {
    cachedAt: Date.now(),
    packages,
    counts: {
      casks: casksRaw.length,
      formulae: formulaeRaw.length,
      total: packages.length,
    },
  };
  await writeCache(cachePath, payload);
  return payload;
}

function parseListVersions(stdout, type) {
  const installed = {};
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [name, ...versions] = trimmed.split(/\s+/);
    installed[`${type}:${name}`] = {
      id: name,
      type,
      version: versions.join(" "),
    };
  }
  return installed;
}

async function getInstalled(brewPath) {
  const [{ stdout: formulaOut }, { stdout: caskOut }] = await Promise.all([
    runBrew(brewPath, ["list", "--formula", "--versions"]),
    runBrew(brewPath, ["list", "--cask", "--versions"]).catch(() => ({
      stdout: "",
    })),
  ]);

  return {
    ...parseListVersions(formulaOut, "formula"),
    ...parseListVersions(caskOut, "cask"),
  };
}

async function getOutdated(brewPath) {
  try {
    const { stdout } = await runBrew(brewPath, ["outdated", "--json=v2"]);
    const data = JSON.parse(stdout || "{}");
    const map = {};
    for (const f of data.formulae || []) {
      map[`formula:${f.name}`] = {
        id: f.name,
        type: "formula",
        current: f.installed_versions?.join(", ") || "",
        latest: f.current_version || "",
      };
    }
    for (const c of data.casks || []) {
      map[`cask:${c.name}`] = {
        id: c.name,
        type: "cask",
        current: c.installed_versions?.join(", ") || "",
        latest: c.current_version || "",
      };
    }
    return map;
  } catch {
    return {};
  }
}

async function installPackage(brewPath, { id, type }, onData) {
  const args = type === "cask" ? ["install", "--cask", id] : ["install", id];
  return runBrew(brewPath, args, { onData });
}

async function uninstallPackage(brewPath, { id, type }, onData) {
  const args =
    type === "cask" ? ["uninstall", "--cask", id] : ["uninstall", id];
  return runBrew(brewPath, args, { onData });
}

async function upgradePackage(brewPath, { id, type }, onData) {
  const args = type === "cask" ? ["upgrade", "--cask", id] : ["upgrade", id];
  return runBrew(brewPath, args, { onData });
}

async function upgradeAll(brewPath, onData) {
  return runBrew(brewPath, ["upgrade"], { onData });
}

async function getBrewInfo() {
  const status = await probeBrew();
  if (!status.installed) {
    const err = new Error("Homebrew is not installed");
    err.code = "BREW_NOT_FOUND";
    throw err;
  }
  return {
    brewPath: status.brewPath,
    version: status.version,
  };
}

module.exports = {
  resolveBrew,
  findBrewPath,
  probeBrew,
  installHomebrew,
  BREW_INSTALL_SCRIPT,
  BREW_SITE,
  loadCatalog,
  getInstalled,
  getOutdated,
  installPackage,
  uninstallPackage,
  upgradePackage,
  upgradeAll,
  getBrewInfo,
};
