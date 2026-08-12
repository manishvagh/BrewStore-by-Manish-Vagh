const { spawn, execFile } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const https = require("node:https");

const execFileAsync = promisify(execFile);

function isRealUsername(name) {
  return typeof name === "string" && name.length > 0 && !/^\d+$/.test(name);
}

function resolveIdentity() {
  let home = process.env.HOME;
  let username = process.env.USER || process.env.LOGNAME;

  try {
    const info = os.userInfo();
    if (info.homedir) home = home || info.homedir;
    if (isRealUsername(info.username)) username = info.username;
  } catch {
    // getpwuid can fail when the process uid has no passwd entry
    // (GUI apps, sandboxes). Homebrew 6+ then crashes in Dir.home.
  }

  if (!home) {
    const guessed = isRealUsername(username) ? `/Users/${username}` : "";
    home = guessed || os.homedir() || os.tmpdir();
  }

  if (!isRealUsername(username)) {
    const match = String(home).match(/^\/Users\/([^/]+)/);
    if (match) username = match[1];
  }

  return {
    home,
    username: isRealUsername(username) ? username : "user",
  };
}

// Finder-launched GUI apps can inherit USER=<numeric uid>, which breaks Homebrew 6.
const bootIdentity = resolveIdentity();
process.env.HOME = bootIdentity.home;
process.env.USER = bootIdentity.username;
process.env.LOGNAME = bootIdentity.username;

function brewEnv(overrides = {}) {
  const { home, username } = resolveIdentity();
  return {
    ...process.env,
    HOME: home,
    USER: username,
    LOGNAME: username,
    TMPDIR: process.env.TMPDIR || os.tmpdir(),
    PATH: [
      "/opt/homebrew/bin",
      "/opt/homebrew/sbin",
      "/usr/local/bin",
      "/usr/bin",
      "/bin",
      "/usr/sbin",
      "/sbin",
      process.env.PATH || "",
    ].join(":"),
    HOMEBREW_NO_AUTO_UPDATE: "1",
    HOMEBREW_NO_ENV_HINTS: "1",
    HOMEBREW_COLOR: "0",
    HOMEBREW_NO_ANALYTICS: "1",
    ...overrides,
  };
}

const BREW_CANDIDATES = [
  "/opt/homebrew/bin/brew",
  "/usr/local/bin/brew",
  "brew",
];

const CASK_API = "https://formulae.brew.sh/api/cask.json";
const FORMULA_API = "https://formulae.brew.sh/api/formula.json";
const CASK_ANALYTICS_API =
  "https://formulae.brew.sh/api/analytics/cask-install/homebrew-cask/30d.json";
const FORMULA_ANALYTICS_API =
  "https://formulae.brew.sh/api/analytics/install-on-request/homebrew-core/30d.json";
const CATALOG_TTL_MS = 1000 * 60 * 60 * 12;

const BREW_INSTALL_SCRIPT =
  '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';
const BREW_SITE = "https://brew.sh";

async function findBrewPath() {
  for (const candidate of BREW_CANDIDATES) {
    try {
      if (candidate === "brew") {
        await execFileAsync("brew", ["--version"], { env: brewEnv() });
        return "brew";
      }
      await fs.access(candidate);
      // Confirm the binary actually runs (stale path / broken install).
      await execFileAsync(candidate, ["--version"], { env: brewEnv() });
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
            env: brewEnv({
              PATH: `${binDir}:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin`,
              SUDO_ASKPASS: askPassPath,
              NONINTERACTIVE: "1",
              CI: "1",
            }),
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

function runBrew(brewPath, args, { onData, allowFail = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(brewPath, args, {
      env: brewEnv(),
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
      if (code === 0 || allowFail) {
        resolve({ stdout, stderr, code: code ?? 0 });
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

function parseAnalyticsCount(raw) {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    return Number(String(raw).replace(/,/g, "")) || 0;
  }
  return 0;
}

function rankAnalyticsFormulae(formulaeMap, nameKey) {
  const rows = [];
  if (!formulaeMap || typeof formulaeMap !== "object") return rows;
  for (const entries of Object.values(formulaeMap)) {
    const list = Array.isArray(entries) ? entries : [entries];
    for (const entry of list) {
      if (!entry || typeof entry !== "object") continue;
      const token = entry[nameKey] || entry.formula || entry.cask;
      if (!token) continue;
      rows.push({
        token: String(token),
        count: parseAnalyticsCount(entry.count),
      });
    }
  }
  rows.sort((a, b) => b.count - a.count);
  return rows;
}

async function loadTrending(userDataPath, { force = false } = {}) {
  const cachePath = path.join(userDataPath, "trending-cache-v1.json");
  if (!force) {
    const cached = await readCache(cachePath);
    if (cached) return cached;
  }

  try {
    const [caskData, formulaData] = await Promise.all([
      fetchJson(CASK_ANALYTICS_API),
      fetchJson(FORMULA_ANALYTICS_API),
    ]);

    const payload = {
      cachedAt: Date.now(),
      casks: rankAnalyticsFormulae(caskData.formulae, "cask").slice(0, 80),
      formulae: rankAnalyticsFormulae(formulaData.formulae, "formula").slice(
        0,
        80,
      ),
    };
    await writeCache(cachePath, payload);
    return payload;
  } catch (err) {
    const cached = await readCache(cachePath).catch(() => null);
    if (cached) return cached;
    return {
      cachedAt: Date.now(),
      casks: [],
      formulae: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
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

const PROTECTED_TAPS = new Set(["homebrew/core", "homebrew/cask"]);

async function listTaps(brewPath) {
  const { stdout } = await runBrew(brewPath, ["tap"]);
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((name) => ({
      name,
      official: PROTECTED_TAPS.has(name) || name.startsWith("homebrew/"),
      removable: !PROTECTED_TAPS.has(name),
    }));
}

async function addTap(brewPath, name, onData) {
  const tap = String(name || "").trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(tap)) {
    throw new Error("Tap must look like user/repo");
  }
  await runBrew(brewPath, ["tap", tap], { onData });
  return { ok: true };
}

async function removeTap(brewPath, name, onData) {
  const tap = String(name || "").trim();
  if (PROTECTED_TAPS.has(tap)) {
    throw new Error(`Cannot remove protected tap: ${tap}`);
  }
  await runBrew(brewPath, ["untap", tap], { onData });
  return { ok: true };
}

async function listPinned(brewPath) {
  try {
    const { stdout } = await runBrew(brewPath, ["list", "--pinned"]);
    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function pinPackage(brewPath, { id }, onData) {
  await runBrew(brewPath, ["pin", id], { onData });
  return { ok: true };
}

async function unpinPackage(brewPath, { id }, onData) {
  await runBrew(brewPath, ["unpin", id], { onData });
  return { ok: true };
}

function parseSizeToBytes(text) {
  const match = String(text).match(
    /([\d.,]+)\s*(bytes?|KB|MB|GB|TB|KiB|MiB|GiB|TiB)/i,
  );
  if (!match) return 0;
  const value = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(value)) return 0;
  const unit = match[2].toLowerCase();
  const factors = {
    byte: 1,
    bytes: 1,
    kb: 1000,
    kib: 1024,
    mb: 1000 ** 2,
    mib: 1024 ** 2,
    gb: 1000 ** 3,
    gib: 1024 ** 3,
    tb: 1000 ** 4,
    tib: 1024 ** 4,
  };
  return Math.round(value * (factors[unit] || 1));
}

async function cleanupDryRun(brewPath, onData) {
  const { stdout, stderr } = await runBrew(
    brewPath,
    ["cleanup", "-n", "--prune=all"],
    { onData, allowFail: true },
  );
  const text = `${stdout}\n${stderr}`;
  const items = [];
  let reclaimableBytes = 0;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/would remove|removing:/i.test(trimmed) || trimmed.startsWith("/")) {
      const bytes = parseSizeToBytes(trimmed);
      reclaimableBytes += bytes;
      items.push({ path: trimmed, bytes });
    }
  }
  // Sometimes brew prints a summary line with total size
  const summary = text.match(/This operation would free approximately\s+([^\n]+)/i);
  if (summary) {
    const summaryBytes = parseSizeToBytes(summary[1]);
    if (summaryBytes > reclaimableBytes) reclaimableBytes = summaryBytes;
  }
  return {
    items: items.slice(0, 200),
    reclaimableBytes,
    raw: text.trim(),
  };
}

async function cleanup(brewPath, onData) {
  await runBrew(brewPath, ["cleanup", "--prune=all"], { onData });
  return { ok: true };
}

async function doctor(brewPath, onData) {
  const { stdout, stderr, code } = await runBrew(brewPath, ["doctor"], {
    onData,
    allowFail: true,
  });
  const text = `${stdout}\n${stderr}`.trim();
  const findings = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^error:/i.test(trimmed)) {
      findings.push({ severity: "error", message: trimmed.replace(/^error:\s*/i, "") });
    } else if (/^warning:/i.test(trimmed)) {
      findings.push({
        severity: "warning",
        message: trimmed.replace(/^warning:\s*/i, ""),
      });
    } else if (/^please|your system|configuration|unexpected/i.test(trimmed)) {
      findings.push({ severity: "note", message: trimmed });
    }
  }
  if (findings.length === 0 && text) {
    findings.push({
      severity: code === 0 ? "note" : "warning",
      message: code === 0 ? "Your system is ready to brew." : text.slice(0, 500),
    });
  }
  return { ok: code === 0, code, findings, raw: text };
}

async function listServices(brewPath) {
  try {
    const { stdout } = await runBrew(brewPath, ["services", "list", "--json"], {
      allowFail: true,
    });
    const data = JSON.parse(stdout || "[]");
    if (!Array.isArray(data)) return [];
    return data.map((row) => ({
      name: row.name || row.service_name || "",
      status: row.status || "unknown",
      user: row.user || null,
      file: row.file || null,
    })).filter((row) => row.name);
  } catch {
    // Fallback plain list
    try {
      const { stdout } = await runBrew(brewPath, ["services", "list"], {
        allowFail: true,
      });
      return stdout
        .split("\n")
        .slice(1)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const parts = line.split(/\s+/);
          return {
            name: parts[0] || "",
            status: parts[1] || "unknown",
            user: parts[2] || null,
            file: null,
          };
        })
        .filter((row) => row.name);
    } catch {
      return [];
    }
  }
}

async function serviceAction(brewPath, { name, action }, onData) {
  const allowed = new Set(["start", "stop", "restart"]);
  if (!allowed.has(action)) throw new Error(`Unsupported service action: ${action}`);
  const service = String(name || "").trim();
  if (!service) throw new Error("Service name required");
  await runBrew(brewPath, ["services", action, service], { onData });
  return { ok: true };
}

async function getDeps(brewPath, { id, type }) {
  try {
    if (type === "cask") {
      const { stdout } = await runBrew(
        brewPath,
        ["deps", "--cask", id],
        { allowFail: true },
      );
      return stdout
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    }
    const { stdout } = await runBrew(
      brewPath,
      ["deps", "--json=v2", id],
      { allowFail: true },
    );
    try {
      const data = JSON.parse(stdout || "[]");
      const row = Array.isArray(data) ? data[0] : data;
      const deps = row?.deps || row?.dependencies || [];
      if (Array.isArray(deps)) {
        return deps.map((d) => (typeof d === "string" ? d : d.name)).filter(Boolean);
      }
    } catch {
      // fall through to plain
    }
    const { stdout: plain } = await runBrew(brewPath, ["deps", id], {
      allowFail: true,
    });
    return plain
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function getDependents(brewPath, { id }) {
  try {
    const { stdout } = await runBrew(
      brewPath,
      ["uses", "--installed", id],
      { allowFail: true },
    );
    return stdout
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function bundleDump(brewPath, filePath, onData) {
  if (!filePath) throw new Error("Brewfile path required");
  await runBrew(
    brewPath,
    ["bundle", "dump", "--force", `--file=${filePath}`],
    { onData },
  );
  return { ok: true, path: filePath };
}

async function bundleInstall(brewPath, filePath, onData) {
  if (!filePath) throw new Error("Brewfile path required");
  await runBrew(brewPath, ["bundle", "install", `--file=${filePath}`], {
    onData,
  });
  return { ok: true, path: filePath };
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

async function getPackageDiskUsage(brewPath, { id, type }) {
  try {
    const flag = type === "cask" ? "--caskroom" : "--cellar";
    const { stdout: rootOut } = await runBrew(brewPath, [flag]);
    const root = path.join(String(rootOut || "").trim(), id);
    try {
      await fs.access(root);
    } catch {
      return { id, type, bytes: 0, path: root, missing: true };
    }
    const { stdout } = await execFileAsync("/usr/bin/du", ["-sk", root], {
      maxBuffer: 1024 * 1024,
    });
    const kb = Number.parseInt(String(stdout).trim().split(/\s+/)[0], 10);
    return {
      id,
      type,
      bytes: Number.isFinite(kb) ? kb * 1024 : 0,
      path: root,
      missing: false,
    };
  } catch {
    return { id, type, bytes: 0, path: null, missing: true };
  }
}

async function getDiskUsageMap(brewPath, packages) {
  const list = Array.isArray(packages) ? packages.slice(0, 200) : [];
  const results = await Promise.all(
    list.map((pkg) => getPackageDiskUsage(brewPath, pkg)),
  );
  const map = {};
  for (const item of results) {
    map[`${item.type}:${item.id}`] = item;
  }
  return map;
}

async function openInstalledCask(pkgInfo) {
  const names = [];
  if (Array.isArray(pkgInfo?.appNames)) {
    for (const name of pkgInfo.appNames) {
      if (typeof name === "string" && name.trim()) names.push(name.trim());
    }
  }
  if (pkgInfo?.name && !names.includes(pkgInfo.name)) {
    names.push(String(pkgInfo.name));
  }
  if (pkgInfo?.id && !names.includes(pkgInfo.id)) {
    names.push(String(pkgInfo.id));
  }

  const errors = [];
  for (const name of names) {
    const candidates = name.endsWith(".app") ? [name] : [name, `${name}.app`];
    for (const candidate of candidates) {
      try {
        await execFileAsync("/usr/bin/open", ["-a", candidate]);
        return { ok: true, app: candidate };
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }
  }

  // Fall back to Applications folder match
  for (const name of names) {
    const base = name.replace(/\.app$/i, "");
    const appPath = `/Applications/${base}.app`;
    try {
      await fs.access(appPath);
      await execFileAsync("/usr/bin/open", [appPath]);
      return { ok: true, app: appPath };
    } catch {
      // continue
    }
  }

  const err = new Error(
    errors[0] || `Could not open app for ${pkgInfo?.id || "cask"}`,
  );
  throw err;
}

function compareSemver(a, b) {
  const pa = String(a)
    .replace(/^v/i, "")
    .split(/[.+-]/)
    .map((n) => Number.parseInt(n, 10) || 0);
  const pb = String(b)
    .replace(/^v/i, "")
    .split(/[.+-]/)
    .map((n) => Number.parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

async function checkAppUpdate(currentVersion) {
  const url =
    "https://api.github.com/repos/manishvagh/BrewStore-by-Manish-Vagh/releases/latest";
  const raw = await new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "BrewStore",
          Accept: "application/vnd.github+json",
        },
        timeout: 12000,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`GitHub releases HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("GitHub releases request timed out"));
    });
  });

  const data = JSON.parse(raw || "{}");
  const latest = String(data.tag_name || data.name || "").replace(/^v/i, "");
  const current = String(currentVersion || "0.0.0").replace(/^v/i, "");
  const assets = Array.isArray(data.assets) ? data.assets : [];
  const dmg =
    assets.find((a) => /\.dmg$/i.test(a.name || "")) ||
    assets.find((a) => /arm64.*\.dmg/i.test(a.name || "")) ||
    null;

  return {
    updateAvailable: Boolean(latest) && compareSemver(latest, current) > 0,
    currentVersion: current,
    latestVersion: latest || current,
    releaseUrl: data.html_url || "https://github.com/manishvagh/BrewStore-by-Manish-Vagh/releases/latest",
    downloadUrl: dmg?.browser_download_url || null,
    notes: typeof data.body === "string" ? data.body.slice(0, 2000) : "",
    publishedAt: data.published_at || null,
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
  loadTrending,
  getInstalled,
  getOutdated,
  installPackage,
  uninstallPackage,
  upgradePackage,
  upgradeAll,
  listTaps,
  addTap,
  removeTap,
  listPinned,
  pinPackage,
  unpinPackage,
  cleanupDryRun,
  cleanup,
  doctor,
  listServices,
  serviceAction,
  getDeps,
  getDependents,
  bundleDump,
  bundleInstall,
  getBrewInfo,
  getPackageDiskUsage,
  getDiskUsageMap,
  openInstalledCask,
  checkAppUpdate,
};
