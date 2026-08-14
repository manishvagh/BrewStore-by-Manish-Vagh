const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const MAX_TXNS = 80;
const listeners = new Set();

let chain = Promise.resolve();
let userData = null;
let txns = [];
let current = null;

function emit(event, payload) {
  for (const fn of listeners) {
    try {
      fn(event, payload);
    } catch {
      // ignore listener errors
    }
  }
}

function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setUserData(dir) {
  userData = dir;
}

function logPath() {
  return path.join(userData || ".", "activity-log.json");
}

async function load() {
  if (!userData) return;
  try {
    const raw = await fs.readFile(logPath(), "utf8");
    const data = JSON.parse(raw);
    if (Array.isArray(data)) txns = data.slice(-MAX_TXNS);
  } catch {
    txns = [];
  }
}

async function persist() {
  if (!userData) return;
  try {
    await fs.writeFile(logPath(), JSON.stringify(txns.slice(-MAX_TXNS), null, 0));
  } catch {
    // ignore disk errors
  }
}

function snapshot() {
  return {
    current: current
      ? {
          id: current.id,
          action: current.action,
          pkgId: current.pkgId,
          startedAt: current.startedAt,
        }
      : null,
    waiting: Boolean(current),
    recent: txns.slice(-40),
  };
}

function enqueue(meta, fn) {
  const job = {
    id: crypto.randomUUID(),
    action: String(meta.action || "brew"),
    pkgId: meta.pkgId || null,
    args: Array.isArray(meta.args) ? meta.args : [],
    startedAt: null,
    endedAt: null,
    status: "queued",
    error: null,
    lines: [],
  };

  const run = chain.then(async () => {
    job.startedAt = Date.now();
    job.status = "running";
    current = job;
    emit("queue", snapshot());
    const onData = (text) => {
      const chunk = String(text || "");
      if (!chunk) return;
      job.lines.push(chunk);
      if (job.lines.length > 200) job.lines.splice(0, job.lines.length - 200);
      meta.onData?.(chunk);
    };
    try {
      const result = await fn(onData);
      job.status = "ok";
      job.endedAt = Date.now();
      txns.push(stripLines(job));
      await persist();
      return result;
    } catch (err) {
      job.status = "error";
      job.endedAt = Date.now();
      job.error = err instanceof Error ? err.message : String(err);
      txns.push(stripLines(job));
      await persist();
      throw err;
    } finally {
      current = null;
      emit("queue", snapshot());
    }
  });

  chain = run.then(
    () => {},
    () => {},
  );
  emit("queue", snapshot());
  return run;
}

function stripLines(job) {
  return {
    id: job.id,
    action: job.action,
    pkgId: job.pkgId,
    args: job.args,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
    status: job.status,
    error: job.error,
    excerpt: job.lines.join("").trim().slice(-1500),
  };
}

function listTxns() {
  return snapshot();
}

module.exports = {
  setUserData,
  load,
  enqueue,
  onChange,
  listTxns,
};
