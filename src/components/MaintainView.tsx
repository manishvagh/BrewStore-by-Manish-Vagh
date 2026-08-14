import { useCallback, useEffect, useState } from "react";
import type {
  BrewfileDiff,
  BrewService,
  BrewTap,
  CleanupPreview,
  DoctorReport,
} from "../types";

type TabId = "taps" | "services" | "cleanup" | "doctor" | "bundle";

interface Props {
  api: Window["brewStore"];
  onLog: (line: string) => void;
  onRefreshInstalled: () => Promise<void>;
}

const TABS: { id: TabId; label: string }[] = [
  { id: "taps", label: "Taps" },
  { id: "services", label: "Services" },
  { id: "cleanup", label: "Cleanup" },
  { id: "doctor", label: "Doctor" },
  { id: "bundle", label: "Bundle" },
];

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let i = 0;
  while (value >= 1000 && i < units.length - 1) {
    value /= 1000;
    i += 1;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function DiffList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ id?: string; name?: string; type?: string; present?: boolean }>;
}) {
  if (!rows.length) return null;
  return (
    <div className="brewfile-diff-block">
      <p className="deps-label">{title}</p>
      <ul className="brewfile-diff">
        {rows.map((row) => (
          <li key={`${row.type || "tap"}:${row.id || row.name}`}>
            {row.id || row.name}
            {row.type ? ` (${row.type})` : ""}
            {row.present === false ? " — missing tap" : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MaintainView({ api, onLog, onRefreshInstalled }: Props) {
  const [tab, setTab] = useState<TabId>("taps");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [taps, setTaps] = useState<BrewTap[]>([]);
  const [tapInput, setTapInput] = useState("");
  const [services, setServices] = useState<BrewService[]>([]);
  const [cleanupPreview, setCleanupPreview] = useState<CleanupPreview | null>(null);
  const [leaves, setLeaves] = useState<string[]>([]);
  const [orphans, setOrphans] = useState<string[]>([]);
  const [doctorReport, setDoctorReport] = useState<DoctorReport | null>(null);
  const [bundleMessage, setBundleMessage] = useState<string | null>(null);
  const [bundleDiff, setBundleDiff] = useState<BrewfileDiff | null>(null);
  const [bundlePath, setBundlePath] = useState<string | null>(null);

  const run = useCallback(
    async (label: string, fn: () => Promise<void>) => {
      setBusy(true);
      setError(null);
      onLog(`→ ${label}`);
      try {
        await fn();
        onLog(`✓ ${label}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        onLog(`✗ ${label}: ${message}`);
      } finally {
        setBusy(false);
      }
    },
    [onLog],
  );

  const loadTaps = useCallback(async () => {
    setTaps(await api.listTaps());
  }, [api]);

  const loadServices = useCallback(async () => {
    setServices(await api.listServices());
  }, [api]);

  useEffect(() => {
    void (async () => {
      try {
        if (tab === "taps") await loadTaps();
        if (tab === "services") await loadServices();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [tab, loadTaps, loadServices]);

  useEffect(() => {
    if (tab !== "services") return;
    const timer = window.setInterval(() => {
      void loadServices().catch(() => {});
    }, 8000);
    return () => window.clearInterval(timer);
  }, [tab, loadServices]);

  const failedServices = services.filter((s) => /error|unknown/i.test(s.status));

  return (
    <section className="page maintain">
      <header className="page-header">
        <h1>Maintain</h1>
        <p>Taps, services, cleanup, doctor, and Brewfile tools</p>
      </header>

      <div className="maintain-tabs" role="tablist" aria-label="Maintain tools">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`maintain-tab ${tab === item.id ? "active" : ""}`}
            onClick={() => {
              setTab(item.id);
              setError(null);
              setBundleMessage(null);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="maintain-error" role="alert">
          {error}
        </p>
      )}

      {tab === "taps" && (
        <div className="maintain-panel glass-card">
          <div className="maintain-row">
            <input
              className="maintain-input"
              value={tapInput}
              onChange={(e) => setTapInput(e.target.value)}
              placeholder="user/repo"
              aria-label="Tap name"
              disabled={busy}
            />
            <button
              type="button"
              className="btn primary"
              disabled={busy || !tapInput.trim()}
              onClick={() =>
                void run(`brew tap ${tapInput.trim()}`, async () => {
                  setTaps(await api.addTap(tapInput.trim()));
                  setTapInput("");
                })
              }
            >
              Add tap
            </button>
          </div>
          <ul className="maintain-list">
            {taps.map((tap) => (
              <li key={tap.name}>
                <div>
                  <strong>{tap.name}</strong>
                  <span className="tag">{tap.official ? "Official" : "Third-party"}</span>
                </div>
                <button
                  type="button"
                  className="btn soft"
                  disabled={busy || !tap.removable}
                  onClick={() => {
                    if (!window.confirm(`Remove tap ${tap.name}?`)) return;
                    void run(`brew untap ${tap.name}`, async () => {
                      setTaps(await api.removeTap(tap.name));
                    });
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
            {taps.length === 0 && <li className="muted">No taps found.</li>}
          </ul>
        </div>
      )}

      {tab === "services" && (
        <div className="maintain-panel glass-card">
          <div className="maintain-actions">
            <button
              type="button"
              className="btn soft"
              disabled={busy}
              onClick={() => void run("Refresh services", loadServices)}
            >
              Refresh
            </button>
            {failedServices.length > 0 && (
              <button
                type="button"
                className="btn primary"
                disabled={busy}
                onClick={() =>
                  void run("Restart failed services", async () => {
                    setServices(
                      await api.serviceAction({
                        name: failedServices[0]!.name,
                        action: "restart-failed",
                      }),
                    );
                  })
                }
              >
                Restart failed
              </button>
            )}
          </div>
          <ul className="maintain-list">
            {services.map((service) => (
              <li key={service.name}>
                <div>
                  <strong>{service.name}</strong>
                  <span className={`tag service-${service.status}`}>{service.status}</span>
                  {service.user && <span className="muted"> · {service.user}</span>}
                </div>
                <div className="maintain-inline-actions">
                  {(["start", "stop", "restart"] as const).map((action) => (
                    <button
                      key={action}
                      type="button"
                      className="btn soft"
                      disabled={busy}
                      onClick={() =>
                        void run(`brew services ${action} ${service.name}`, async () => {
                          setServices(
                            await api.serviceAction({ name: service.name, action }),
                          );
                        })
                      }
                    >
                      {action}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="btn soft"
                    disabled={busy}
                    onClick={() =>
                      void run(`Open log ${service.name}`, async () => {
                        const result = await api.openServiceLog(service.name);
                        if (!result.ok) {
                          throw new Error(result.error || "Could not open service log");
                        }
                      })
                    }
                  >
                    Log
                  </button>
                </div>
              </li>
            ))}
            {services.length === 0 && (
              <li className="muted">No brew services on this Mac.</li>
            )}
          </ul>
        </div>
      )}

      {tab === "cleanup" && (
        <div className="maintain-panel glass-card">
          <p className="maintain-lead">
            Preview reclaimable Homebrew cache and old kegs, then clean up.
            Leaves are formulae you installed on purpose; orphans can be removed.
          </p>
          <div className="maintain-actions">
            <button
              type="button"
              className="btn soft"
              disabled={busy}
              onClick={() =>
                void run("brew cleanup --dry-run", async () => {
                  setCleanupPreview(await api.cleanupDryRun());
                })
              }
            >
              Scan cache
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={busy}
              onClick={() => {
                if (!window.confirm("Run brew cleanup and delete old files?")) return;
                void run("brew cleanup", async () => {
                  await api.cleanup();
                  setCleanupPreview(await api.cleanupDryRun());
                });
              }}
            >
              Clean up
            </button>
            <button
              type="button"
              className="btn soft"
              disabled={busy}
              onClick={() =>
                void run("List leaves & orphans", async () => {
                  const [nextLeaves, dry] = await Promise.all([
                    api.listLeaves(),
                    api.autoremoveDryRun(),
                  ]);
                  setLeaves(nextLeaves);
                  setOrphans(dry.packages);
                })
              }
            >
              Find orphans
            </button>
            <button
              type="button"
              className="btn danger"
              disabled={busy || orphans.length === 0}
              onClick={() => {
                if (
                  !window.confirm(
                    `Remove unused dependencies?\n\n${orphans.slice(0, 20).join(", ")}`,
                  )
                ) {
                  return;
                }
                void run("brew autoremove", async () => {
                  await api.autoremove();
                  setOrphans([]);
                  setLeaves(await api.listLeaves());
                  await onRefreshInstalled();
                });
              }}
            >
              Autoremove
            </button>
          </div>
          {cleanupPreview && (
            <div className="cleanup-summary">
              <p>
                Reclaimable:{" "}
                <strong>{formatBytes(cleanupPreview.reclaimableBytes)}</strong>
                {" · "}
                {cleanupPreview.items.length} item
                {cleanupPreview.items.length === 1 ? "" : "s"} listed
              </p>
              <pre className="maintain-log">
                {cleanupPreview.items.length
                  ? cleanupPreview.items
                      .slice(0, 40)
                      .map((item) => item.path)
                      .join("\n")
                  : cleanupPreview.raw || "Nothing to clean."}
              </pre>
            </div>
          )}
          {leaves.length > 0 && (
            <div className="cleanup-summary">
              <p className="deps-label">Leaves ({leaves.length})</p>
              <p className="deps-values">{leaves.join(", ")}</p>
            </div>
          )}
          {orphans.length > 0 && (
            <div className="cleanup-summary">
              <p className="deps-label">Unused dependencies ({orphans.length})</p>
              <p className="deps-values">{orphans.join(", ")}</p>
            </div>
          )}
        </div>
      )}

      {tab === "doctor" && (
        <div className="maintain-panel glass-card">
          <p className="maintain-lead">
            Check Homebrew health and surface warnings in plain language.
          </p>
          <div className="maintain-actions">
            <button
              type="button"
              className="btn primary"
              disabled={busy}
              onClick={() =>
                void run("brew doctor", async () => {
                  setDoctorReport(await api.doctor());
                })
              }
            >
              Run doctor
            </button>
          </div>
          {doctorReport && (
            <ul className="doctor-list">
              {doctorReport.findings.map((finding, index) => (
                <li key={`${finding.severity}-${index}`} className={`doctor-${finding.severity}`}>
                  <span className="tag">{finding.severity}</span>
                  <p>{finding.message}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "bundle" && (
        <div className="maintain-panel glass-card">
          <p className="maintain-lead">
            Export your installed set as a Brewfile, preview a file against this
            Mac, then import to install the missing packages.
          </p>
          <div className="maintain-actions">
            <button
              type="button"
              className="btn primary"
              disabled={busy}
              onClick={() =>
                void run("Export Brewfile", async () => {
                  const result = await api.bundleExport();
                  if (result.canceled) {
                    setBundleMessage("Export canceled.");
                    return;
                  }
                  setBundleMessage(`Exported to ${result.path}`);
                })
              }
            >
              Export Brewfile
            </button>
            <button
              type="button"
              className="btn soft"
              disabled={busy}
              onClick={() =>
                void run("Preview Brewfile", async () => {
                  const result = await api.bundlePreview();
                  if (result.canceled) {
                    setBundleMessage("Preview canceled.");
                    setBundleDiff(null);
                    return;
                  }
                  setBundlePath(result.path || null);
                  setBundleDiff(result.diff || null);
                  setBundleMessage(
                    result.path ? `Compared ${result.path}` : "Brewfile compared.",
                  );
                })
              }
            >
              Preview Brewfile
            </button>
            <button
              type="button"
              className="btn soft"
              disabled={busy}
              onClick={() => {
                const extra = bundleDiff
                  ? `\n\nWill install ${bundleDiff.missing.length} missing package(s).`
                  : "";
                if (
                  !window.confirm(
                    `Import and install packages from a Brewfile? This may take a while.${extra}`,
                  )
                ) {
                  return;
                }
                void run("Import Brewfile", async () => {
                  const result = await api.bundleImport();
                  if (result.canceled) {
                    setBundleMessage("Import canceled.");
                    return;
                  }
                  setBundleMessage(`Installed from ${result.path}`);
                  setBundleDiff(null);
                  await onRefreshInstalled();
                });
              }}
            >
              Import Brewfile
            </button>
          </div>
          {bundleMessage && <p className="muted">{bundleMessage}</p>}
          {bundleDiff && (
            <div className="brewfile-diff-panel">
              {bundlePath && <p className="muted">{bundlePath}</p>}
              <DiffList title="Missing taps" rows={bundleDiff.taps.filter((t) => !t.present)} />
              <DiffList title="Not installed yet" rows={bundleDiff.missing} />
              <DiffList title="On this Mac, not in Brewfile" rows={bundleDiff.extra} />
              <DiffList title="Already matches" rows={bundleDiff.keep.slice(0, 40)} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
