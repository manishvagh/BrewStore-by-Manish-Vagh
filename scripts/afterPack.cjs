const fs = require("node:fs");
const path = require("node:path");

/**
 * Wrap the macOS binary so ELECTRON_RUN_AS_NODE cannot force Node mode
 * when the app is launched from a polluted environment.
 */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appName = context.packager.appInfo.productFilename;
  const macOSDir = path.join(
    context.appOutDir,
    `${appName}.app`,
    "Contents",
    "MacOS",
  );
  const binary = path.join(macOSDir, appName);
  const realBinary = path.join(macOSDir, `${appName}.bin`);

  if (!fs.existsSync(binary) || fs.existsSync(realBinary)) return;

  fs.renameSync(binary, realBinary);
  fs.writeFileSync(
    binary,
    `#!/bin/bash\nexec /usr/bin/env -u ELECTRON_RUN_AS_NODE "$(dirname "$0")/${appName}.bin" "$@"\n`,
    { mode: 0o755 },
  );
};
