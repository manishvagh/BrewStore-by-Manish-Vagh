const fs = require("node:fs/promises");
const path = require("node:path");
const https = require("node:https");
const { app, nativeImage } = require("electron");

const memoryCache = new Map();

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "BrewStore/1.0",
          Accept: "image/png,image/jpeg,*/*",
        },
        timeout: 7000,
      },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          fetchBuffer(res.headers.location).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

function fetchJson(url) {
  return fetchBuffer(url).then((buf) => JSON.parse(buf.toString("utf8")));
}

function safeKey(id) {
  return String(id).replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function cachePaths(userData, id) {
  const dir = path.join(userData, "icon-cache");
  return {
    dir,
    file: path.join(dir, `${safeKey(id)}.png`),
  };
}

async function readCached(userData, id) {
  if (memoryCache.has(id)) return memoryCache.get(id);
  try {
    const { file } = cachePaths(userData, id);
    const buf = await fs.readFile(file);
    const dataUrl = `data:image/png;base64,${buf.toString("base64")}`;
    memoryCache.set(id, dataUrl);
    return dataUrl;
  } catch {
    return undefined;
  }
}

async function writeCached(userData, id, pngBuffer) {
  const { dir, file } = cachePaths(userData, id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, pngBuffer);
  const dataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;
  memoryCache.set(id, dataUrl);
  return dataUrl;
}

function markMiss(id) {
  memoryCache.set(id, null);
  return null;
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function candidateAppPaths(pkg) {
  const names = Array.isArray(pkg.appNames) ? pkg.appNames : [];
  const out = [];
  for (const name of names) {
    const appName = name.endsWith(".app") ? name : `${name}.app`;
    out.push(`/Applications/${appName}`);
    out.push(path.join(process.env.HOME || "", "Applications", appName));
  }
  if (pkg.name) out.push(`/Applications/${pkg.name}.app`);
  if (pkg.token) {
    const titled = pkg.token
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
    out.push(`/Applications/${titled}.app`);
  }
  return [...new Set(out)];
}

function isIco(buf) {
  return (
    buf.length >= 4 &&
    buf[0] === 0x00 &&
    buf[1] === 0x00 &&
    buf[2] === 0x01 &&
    buf[3] === 0x00
  );
}

function pngFromBuffer(buf) {
  if (!buf || buf.length < 24 || isIco(buf)) return null;
  try {
    let img = nativeImage.createFromBuffer(buf);
    if (!img || img.isEmpty()) return null;
    const size = img.getSize();
    if (!size.width || !size.height) return null;
    if (size.width > 128 || size.height > 128) {
      img = img.resize({ width: 128, height: 128, quality: "better" });
    }
    const png = img.toPNG();
    return png && png.length ? png : null;
  } catch {
    return null;
  }
}

async function iconFromLocalApp(appPath) {
  try {
    const img = await app.getFileIcon(appPath, { size: "normal" });
    if (!img || img.isEmpty()) return null;
    return img.toPNG();
  } catch {
    return null;
  }
}

async function iconFromItunes(pkg) {
  const term = encodeURIComponent(pkg.name || pkg.token);
  const url = `https://itunes.apple.com/search?term=${term}&entity=macSoftware&limit=5`;
  const data = await fetchJson(url);
  const results = data.results || [];
  if (!results.length) return null;

  const needle = (pkg.name || pkg.token || "").toLowerCase();
  const match =
    results.find((r) => (r.trackName || "").toLowerCase() === needle) ||
    results.find((r) =>
      (r.trackName || "").toLowerCase().includes(needle.split(/\s+/)[0]),
    ) ||
    results[0];

  const art = (match.artworkUrl512 || match.artworkUrl100 || "").replace(
    "100x100bb",
    "128x128bb",
  );
  if (!art) return null;
  return pngFromBuffer(await fetchBuffer(art));
}

function homepageDomain(homepage) {
  try {
    return new URL(homepage).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function iconFromHomepage(pkg) {
  const domain = homepageDomain(pkg.homepage);
  if (!domain) return null;
  const url = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
  return pngFromBuffer(await fetchBuffer(url));
}

async function resolveOne(userData, pkg) {
  const id = `${pkg.type}:${pkg.id}`;
  try {
    const cached = await readCached(userData, id);
    if (cached !== undefined) return cached;

    if (pkg.type === "cask") {
      for (const appPath of candidateAppPaths(pkg)) {
        if (!(await pathExists(appPath))) continue;
        const png = await iconFromLocalApp(appPath);
        if (png) return writeCached(userData, id, png);
      }

      try {
        const png = await iconFromItunes(pkg);
        if (png) return writeCached(userData, id, png);
      } catch {}
    }

    try {
      const png = await iconFromHomepage(pkg);
      if (png) return writeCached(userData, id, png);
    } catch {}

    return markMiss(id);
  } catch (err) {
    console.error("icon resolve failed", id, err?.message || err);
    return markMiss(id);
  }
}

async function resolveIcons(userData, packages) {
  const result = {};
  const list = Array.isArray(packages) ? packages.slice(0, 24) : [];
  const queue = [...list];
  const workers = Array.from(
    { length: Math.min(4, queue.length || 1) },
    async () => {
      while (queue.length) {
        const pkg = queue.shift();
        if (!pkg?.id) continue;
        const key = `${pkg.type}:${pkg.id}`;
        result[key] = await resolveOne(userData, pkg);
      }
    },
  );
  await Promise.all(workers);
  return result;
}

module.exports = {
  resolveIcons,
  resolveOne,
};
