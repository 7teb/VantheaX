import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";

const secretFilePatterns = [/^\.env($|\.)/i, /^\.npmrc$/i, /^\.pypirc$/i, /^id_rsa$/i, /^id_ed25519$/i, /\.pem$/i, /\.key$/i, /\.p12$/i, /\.pfx$/i, /^secrets\./i, /^credentials\./i];

const isSecretPath = (relativePath) => {
  const normalized = relativePath.replaceAll("\\", "/").toLowerCase();
  if (normalized === ".git/config") {
    return true;
  }
  const parts = normalized.split("/");
  if (parts.some((part) => part === ".ssh")) {
    return true;
  }
  return parts.some((part) => {
    if (part === ".env.example" || part === ".env.sample") {
      return false;
    }
    return secretFilePatterns.some((pattern) => pattern.test(part));
  });
};

const normalizeProjectPath = async (projectPath) => {
  const resolved = await fs.realpath(path.resolve(projectPath || ""));
  const stat = await fs.stat(resolved);
  if (!stat.isDirectory()) {
    throw new Error("Project path is not a directory");
  }
  return resolved;
};

const maxWriteBytes = 1024 * 1024;

const resolveWriteTarget = async (projectPath, relativePath) => {
  const rel = String(relativePath || "");
  if (!rel || rel.includes("\0") || rel.includes(":") || rel.startsWith("\\\\") || path.isAbsolute(rel) || /^[a-z]:/i.test(rel)) {
    throw new Error("Invalid or non-project file path");
  }
  const projectReal = await normalizeProjectPath(projectPath);
  const parent = path.resolve(projectReal, path.dirname(rel));
  const relParent = path.relative(projectReal, parent);
  if (relParent.startsWith("..") || path.isAbsolute(relParent)) {
    throw new Error("Path is outside the project");
  }
  await fs.mkdir(parent, { recursive: true });
  const realParent = await fs.realpath(parent);
  const relReal = path.relative(projectReal, realParent);
  if (relReal.startsWith("..") || path.isAbsolute(relReal)) {
    throw new Error("Path is outside the project");
  }
  const target = path.join(realParent, path.basename(rel));
  try {
    const info = await fs.lstat(target);
    if (info.isSymbolicLink()) {
      throw new Error("Refusing to write through a symlink");
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
  return { root: projectReal, target, relative: path.relative(projectReal, target) };
};

const writeProjectFile = async (projectPath, relativePath, content) => {
  const text = typeof content === "string" ? content : String(content ?? "");
  if (Buffer.byteLength(text, "utf8") > maxWriteBytes) {
    throw new Error("File content exceeds the 1 MB limit");
  }
  const { target, relative } = await resolveWriteTarget(projectPath, relativePath);
  if (isSecretPath(relative)) {
    throw new Error("Refusing to write to a secret file path");
  }
  const tmp = `${target}.${Math.random().toString(16).slice(2)}.tmp`;
  try {
    await fs.writeFile(tmp, text, { encoding: "utf8", flag: "wx" });
    await fs.rename(tmp, target);
  } catch (error) {
    try { await fs.unlink(tmp); } catch {}
    throw error;
  }
  return { path: relative.replaceAll("\\", "/"), bytes: Buffer.byteLength(text, "utf8"), written: true };
};

const root = path.join(os.tmpdir(), "vx-sectest-" + Math.random().toString(16).slice(2));
await fs.mkdir(root, { recursive: true });

let pass = 0;
let fail = 0;
const ok = (name) => { pass += 1; console.log("PASS  " + name); };
const bad = (name, detail) => { fail += 1; console.log("FAIL  " + name + " -> " + detail); };

const expectOk = async (name, rel, content) => {
  try {
    const result = await writeProjectFile(root, rel, content);
    const back = await fs.readFile(path.join(root, result.path), "utf8");
    if (back === content) { ok(name); } else { bad(name, "content mismatch"); }
  } catch (error) {
    bad(name, "threw: " + error.message);
  }
};

const expectThrow = async (name, rel, content) => {
  try {
    await writeProjectFile(root, rel, content ?? "x");
    bad(name, "did NOT throw");
  } catch {
    ok(name);
  }
};

await expectOk("new file", "calc.py", "print(1)");
await expectOk("nested file", "src/util/helper.py", "x = 1");
await expectOk("overwrite existing", "calc.py", "print(2)");
await expectOk(".env.example allowed", ".env.example", "KEY=value");

await expectThrow("absolute windows path", "C:\\Windows\\evil.txt");
await expectThrow("parent traversal back", "..\\..\\evil.txt");
await expectThrow("parent traversal fwd", "../../evil.txt");
await expectThrow("drive relative", "D:evil.txt");
await expectThrow("unc path", "\\\\server\\share\\x.txt");
await expectThrow("ads stream", "calc.py:stream");
await expectThrow("dotenv", ".env");
await expectThrow("dotenv local", ".env.local");
await expectThrow("id_rsa", "id_rsa");
await expectThrow("pem cert", "cert.pem");
await expectThrow("nested secret", "config/secrets.json");
await expectThrow("ssh folder", ".ssh/known_hosts");
await expectThrow("over 1 mb", "big.txt", "a".repeat(maxWriteBytes + 1));

try {
  const outside = path.join(os.tmpdir(), "vx-outside-" + Math.random().toString(16).slice(2));
  await fs.mkdir(outside, { recursive: true });
  await fs.symlink(outside, path.join(root, "linkdir"), "dir");
  await expectThrow("symlink dir escape", "linkdir/escape.txt");
  await fs.rm(outside, { recursive: true, force: true });
} catch (error) {
  console.log("SKIP  symlink dir escape (needs privilege): " + error.message);
}

await fs.rm(root, { recursive: true, force: true });
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail > 0 ? 1 : 0);
