import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import childProcess from "node:child_process";

const root = process.cwd();
const reportsDir = path.join(root, "reports");
fs.mkdirSync(reportsDir, { recursive: true });

const textExtensions = new Set([
  ".dart", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".json", ".yaml",
  ".yml", ".xml", ".html", ".css", ".scss", ".md", ".txt", ".sql", ".env",
  ".example", ".gradle", ".kts", ".properties", ".plist", ".swift", ".kt",
  ".java", ".h", ".cpp", ".cc", ".cmake", ".rc", ".manifest",
]);

const generatedDirNames = new Set([
  ".dart_tool", "build", ".gradle", "node_modules", "coverage", "dist",
  "out", "DerivedData", "Pods", ".idea", ".vscode",
]);

const suspiciousNamePattern =
  /(old|_old|new|_new|copy|копия|backup|bak|temp|tmp|test2|final|final2|latest|working|fixed|fixed2|unused|deprecated|legacy|archive)/i;
const archivePattern = /\.(zip|rar|7z|tar|tgz|tar\.gz|sql|sql\.gz|apk|aab|ipa|exe|msi|dmg)$/i;
const logTempPattern = /\.(log|tmp|cache|sqlite|db|dump)$/i;
const secretNamePattern = /(^|[\\/])(\.env$|.*service.*account.*\.json$|.*keystore.*|.*\.jks$|.*\.p12$|.*\.pem$|.*\.key$|google-services\.json$|GoogleService-Info\.plist$)/i;
const secretContentPatterns = [
  { name: "OPENAI key", pattern: /sk-[A-Za-z0-9_-]{20,}/ },
  { name: "Stripe key", pattern: /(sk_live_|rk_live_|pk_live_)[A-Za-z0-9]{16,}/ },
  { name: "JWT secret assignment", pattern: /\b(JWT_SECRET|SESSION_SECRET|TOKEN_SECRET)\s*=\s*['"]?[^'"\s]{12,}/i },
  { name: "Password assignment", pattern: /\b(PASSWORD|PASS|DB_PASS|MYSQL_PWD)\s*=\s*['"]?[^'"\s]{6,}/i },
  { name: "Private key block", pattern: /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/ },
];

function rel(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

function statSafe(file) {
  try {
    return fs.statSync(file);
  } catch {
    return null;
  }
}

function walk(dir, rows = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const st = statSafe(full);
    if (!st) continue;
    rows.push({
      path: rel(full),
      name: entry.name,
      isDirectory: entry.isDirectory(),
      size: st.size,
      mtime: st.mtime.toISOString(),
    });
    if (entry.isDirectory()) walk(full, rows);
  }
  return rows;
}

function dirSizes(rows) {
  const sizes = new Map();
  for (const row of rows) {
    if (row.isDirectory) continue;
    const parts = row.path.split("/");
    for (let i = 1; i < parts.length; i += 1) {
      const dir = parts.slice(0, i).join("/");
      sizes.set(dir, (sizes.get(dir) ?? 0) + row.size);
    }
  }
  return [...sizes.entries()]
    .map(([directory, size]) => ({ directory, size }))
    .sort((a, b) => b.size - a.size);
}

function run(command) {
  try {
    return childProcess.execSync(command, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 20 * 1024 * 1024,
    }).trim();
  } catch (error) {
    return `${error.stdout ?? ""}${error.stderr ?? error.message}`.trim();
  }
}

function readTextIfSmall(file, size) {
  if (size > 1024 * 1024) return null;
  const ext = path.extname(file);
  if (!textExtensions.has(ext) && !["Dockerfile", ".gitignore"].includes(path.basename(file))) return null;
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function sha256(file) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(file));
  return hash.digest("hex");
}

function classifyPlatform(p) {
  if (p.startsWith("android/")) return "Android";
  if (p.startsWith("ios/")) return "iOS";
  if (p.startsWith("web/")) return "Flutter Web";
  if (p.startsWith("website_source/")) return "Website";
  if (p.startsWith("windows/")) return "Windows";
  if (p.startsWith("macos/")) return "macOS";
  if (p.startsWith("backend/")) return "Backend";
  if (p.startsWith("lib/")) return "Flutter";
  if (p.startsWith("test/")) return "Tests";
  if (p.startsWith("reports/")) return "Reports";
  if (p.startsWith("docs/")) return "Docs";
  return "Project";
}

function addCandidate(candidates, row, category, risk, reason, evidence, action = "review before deletion") {
  candidates.push({
    path: row.path,
    category,
    risk,
    size: row.size,
    platform: classifyPlatform(row.path),
    reason,
    evidence,
    action,
    deleteAutomatically: false,
  });
}

const rows = walk(root);
const files = rows.filter((row) => !row.isDirectory);
const directories = rows.filter((row) => row.isDirectory);
const topDirs = dirSizes(rows).slice(0, 40);
const candidates = [];

for (const row of rows) {
  const parts = row.path.split("/");
  if (row.isDirectory && generatedDirNames.has(row.name)) {
    addCandidate(
      candidates,
      row,
      "GENERATED",
      row.name === "build" || row.name === ".dart_tool" ? "low" : "medium",
      "Directory name matches common generated/local workspace output.",
      "Must verify platform build/deploy does not depend on checked-in output before removal.",
      "candidate: add/confirm gitignore, remove only after approval",
    );
  }
  if (!row.isDirectory && suspiciousNamePattern.test(row.path)) {
    addCandidate(
      candidates,
      row,
      "DUPLICATE_OR_OBSOLETE_NAME",
      "medium",
      "Filename/path contains old/copy/backup/temp/fixed/final style marker.",
      "Name-based signal only; imports/routes/build references still need manual proof.",
    );
  }
  if (!row.isDirectory && archivePattern.test(row.path)) {
    addCandidate(
      candidates,
      row,
      "ARCHIVE_OR_RELEASE_ARTIFACT",
      "high",
      "Archive/release/database dump extension found.",
      "Could be current public release or backup; verify website links, deployment, and secrets before moving/removal.",
    );
  }
  if (!row.isDirectory && logTempPattern.test(row.path)) {
    addCandidate(
      candidates,
      row,
      "TEMPORARY_OR_RUNTIME_DATA",
      "medium",
      "Runtime/log/temp/database-like extension found.",
      "Verify not a required seed/database fixture before removal.",
    );
  }
  if (!row.isDirectory && secretNamePattern.test(row.path)) {
    addCandidate(
      candidates,
      row,
      "SECRET_REVIEW",
      "high",
      "Filename matches secret/credential pattern.",
      "Do not print values. Verify whether file is template, production credential, or required platform config.",
      "candidate: move to env/secure storage only after rotation plan",
    );
  }
  if (parts.includes(".git")) continue;
}

const duplicateGroups = [];
const hashBuckets = new Map();
for (const row of files) {
  if (row.size === 0 || row.size > 50 * 1024 * 1024) continue;
  const full = path.join(root, row.path);
  try {
    const hash = sha256(full);
    const key = `${row.size}:${hash}`;
    if (!hashBuckets.has(key)) hashBuckets.set(key, []);
    hashBuckets.get(key).push(row.path);
  } catch {
    // ignore unreadable files in audit
  }
}
for (const [key, paths] of hashBuckets.entries()) {
  if (paths.length < 2) continue;
  duplicateGroups.push({ key, size: Number(key.split(":")[0]), paths });
  for (const p of paths) {
    addCandidate(
      candidates,
      { path: p, size: Number(key.split(":")[0]) },
      "DUPLICATE",
      "medium",
      "Same byte size and SHA-256 hash as another file.",
      `Duplicate group: ${paths.join(", ")}`,
      "candidate: keep canonical file only after reference/deploy check",
    );
  }
}

const secretFindings = [];
for (const row of files) {
  const full = path.join(root, row.path);
  const text = readTextIfSmall(full, row.size);
  if (text == null) continue;
  for (const rule of secretContentPatterns) {
    if (rule.pattern.test(text)) {
      secretFindings.push({
        path: row.path,
        type: rule.name,
        risk: "high",
        evidence: "Pattern matched; value intentionally not included.",
        rotationRequired: true,
      });
    }
  }
}

const gitStatus = run("git status --short");
const currentBranch = run("git branch --show-current");
const currentHead = run("git rev-parse HEAD");
const tags = run("git tag --list before-full-cleanup");
const cleanupBranch = run("git branch --list chore/full-project-cleanup");
const pubspec = fs.existsSync(path.join(root, "pubspec.yaml"))
  ? fs.readFileSync(path.join(root, "pubspec.yaml"), "utf8")
  : "";
const packageJsonFiles = files
  .filter((row) => row.path.endsWith("package.json"))
  .map((row) => row.path);
const lockFiles = files
  .filter((row) => /(pubspec\.lock|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Podfile\.lock)$/i.test(row.path))
  .map((row) => row.path);

const dependencySummary = {
  pubspecPresent: Boolean(pubspec),
  pubspecDependencyLines: pubspec
    .split(/\r?\n/)
    .filter((line) => /^\s{2}[A-Za-z0-9_]+:\s*(\^|[0-9]|any|path:|sdk:)/.test(line))
    .map((line) => line.trim()),
  packageJsonFiles,
  lockFiles,
};

const generatedPolicy = directories
  .filter((row) => generatedDirNames.has(row.name))
  .map((row) => ({
    path: row.path,
    shouldStoreInGit: false,
    policy: "Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.",
  }));

const audit = {
  generatedAt: new Date().toISOString(),
  root,
  phase: "analysis-only",
  deletionPerformed: false,
  git: {
    currentBranch,
    currentHead,
    cleanupBranchExists: cleanupBranch.includes("chore/full-project-cleanup"),
    beforeCleanupTagExists: tags.includes("before-full-cleanup"),
    dirty: gitStatus.length > 0,
    statusShort: gitStatus.split(/\r?\n/).filter(Boolean),
  },
  inventory: {
    totalEntries: rows.length,
    files: files.length,
    directories: directories.length,
    totalBytes: files.reduce((sum, row) => sum + row.size, 0),
    topDirectories: topDirs,
  },
  dependencies: dependencySummary,
  candidates,
  duplicateGroups,
  secretFindings,
  generatedPolicy,
  blockers: [
    ...(gitStatus.length > 0
      ? ["Working tree contains uncommitted changes; cleanup/deletion is blocked until user confirms preservation strategy."]
      : []),
  ],
  reports: {
    markdown: "reports/project-cleanup-audit.md",
    json: "reports/project-cleanup-audit.json",
  },
};

fs.writeFileSync(
  path.join(reportsDir, "project-cleanup-audit.json"),
  JSON.stringify(audit, null, 2),
  "utf8",
);

const formatBytes = (n) => `${(n / (1024 * 1024)).toFixed(2)} MB`;
const candidateRows = candidates
  .slice(0, 250)
  .map((item) => `| \`${item.path}\` | ${item.category} | ${item.risk} | ${formatBytes(item.size || 0)} | ${item.reason.replaceAll("|", "\\|")} | ${item.action} |`)
  .join("\n");
const duplicateRows = duplicateGroups
  .slice(0, 80)
  .map((group) => `- ${formatBytes(group.size)}: ${group.paths.map((p) => `\`${p}\``).join(", ")}`)
  .join("\n");
const secretRows = secretFindings
  .map((item) => `| \`${item.path}\` | ${item.type} | ${item.risk} | ${item.evidence} | ${item.rotationRequired ? "yes" : "no"} |`)
  .join("\n");
const topDirRows = topDirs
  .slice(0, 25)
  .map((item) => `| \`${item.directory}\` | ${formatBytes(item.size)} |`)
  .join("\n");

const md = `# GlukoTrack Project Cleanup Audit

Generated: ${audit.generatedAt}

Phase: **analysis only**. No files were deleted.

## Backup Gate

The user required a full backup before audit. This report assumes the verified backup was created externally before running the audit.

## Git State

- Branch: \`${currentBranch}\`
- HEAD: \`${currentHead}\`
- Cleanup branch exists: ${audit.git.cleanupBranchExists}
- \`before-full-cleanup\` tag exists: ${audit.git.beforeCleanupTagExists}
- Working tree dirty: ${audit.git.dirty}

${audit.git.dirty ? "**BLOCKER:** cleanup/deletion must not start while uncommitted changes exist unless the user explicitly approves how to preserve them." : ""}

## Inventory

- Files: ${files.length}
- Directories: ${directories.length}
- Total file size: ${formatBytes(audit.inventory.totalBytes)}

## Largest Directories

| Directory | Size |
|---|---:|
${topDirRows}

## Dependency Snapshot

- pubspec.yaml present: ${dependencySummary.pubspecPresent}
- package.json files: ${packageJsonFiles.map((p) => `\`${p}\``).join(", ") || "none"}
- lock files: ${lockFiles.map((p) => `\`${p}\``).join(", ") || "none"}

## Cleanup Candidates

These are candidates only. Nothing in this table is approved for deletion until each item is checked against imports, routes, build files, dynamic loading, deployment, and old client compatibility.

| Path | Category | Risk | Size | Reason | Proposed action |
|---|---|---:|---:|---|---|
${candidateRows || "| none | | | | | |"}

## Duplicate Content Groups

${duplicateRows || "No duplicate content groups detected within scan limits."}

## Secret Review Findings

Values are intentionally not printed.

| Path | Type | Risk | Evidence | Rotation required |
|---|---|---:|---|---|
${secretRows || "| none | | | | |"}

## Generated Directory Policy

${generatedPolicy.map((item) => `- \`${item.path}\`: ${item.policy}`).join("\n") || "No generated directories matched the configured policy list."}

## Next Step

Do not delete anything yet. Review this report, then approve specific cleanup groups. Each approved group should be removed in a separate commit after targeted tests.
`;

fs.writeFileSync(path.join(reportsDir, "project-cleanup-audit.md"), md, "utf8");

console.log(JSON.stringify({
  files: files.length,
  directories: directories.length,
  candidates: candidates.length,
  duplicateGroups: duplicateGroups.length,
  secretFindings: secretFindings.length,
  dirty: audit.git.dirty,
  reports: audit.reports,
}, null, 2));
