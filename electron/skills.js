import path from "node:path";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { app } from "electron";

const maxSkillBytes = 100 * 1024;
const maxDescriptionChars = 1000;
const maxSkills = 200;
const maxNameChars = 80;
const maxExtraFiles = 20;
const fetchTimeout = 20000;
const executableExtensions = new Set([".bat", ".cjs", ".cmd", ".com", ".dll", ".exe", ".jar", ".js", ".mjs", ".msi", ".ps1", ".psm1", ".py", ".rb", ".scr", ".sh", ".vbs", ".wsf"]);

export const skillsRoot = () => path.join(app.getPath("userData"), "skills");

const registryFile = () => path.join(skillsRoot(), "installed.json");

export const skillSlug = (value) => String(value || "")
  .toLowerCase()
  .replace(/[^a-z0-9._-]+/g, "-")
  .slice(0, 60)
  .replace(/^[-._]+/, "")
  .replace(/[-._]+$/, "");

const toSlug = skillSlug;

const sha256 = (text) => createHash("sha256").update(String(text || ""), "utf8").digest("hex");

const parseSkillFile = (raw) => {
  const bytes = Buffer.byteLength(String(raw || ""), "utf8");
  if (bytes > maxSkillBytes) {
    return { error: `SKILL.md is ${bytes} bytes, the limit is ${maxSkillBytes}` };
  }
  const text = String(raw || "").replace(/^﻿/, "").replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) {
    return { error: "SKILL.md must start with a YAML frontmatter block delimited by ---" };
  }
  const close = text.indexOf("\n---", 3);
  if (close === -1) {
    return { error: "SKILL.md frontmatter is never closed with ---" };
  }
  const head = text.slice(4, close);
  const lineEnd = text.indexOf("\n", close + 1);
  const body = lineEnd === -1 ? "" : text.slice(lineEnd + 1).trim();
  const meta = {};
  for (const line of head.split("\n")) {
    const at = line.indexOf(":");
    if (at <= 0 || line.trimStart().startsWith("#")) {
      continue;
    }
    const key = line.slice(0, at).trim().toLowerCase();
    let value = line.slice(at + 1).trim();
    if (value.length > 1 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    if (key) {
      meta[key] = value;
    }
  }
  const name = String(meta.name || "").trim();
  const description = String(meta.description || "").trim();
  if (!name) {
    return { error: "SKILL.md frontmatter has no name" };
  }
  if (name.length > maxNameChars) {
    return { error: `The name is ${name.length} characters, the limit is ${maxNameChars} because it is sent with every request` };
  }
  if (!description) {
    return { error: "SKILL.md frontmatter has no description, and the description is what tells the agent when to use the skill" };
  }
  if (description.length > maxDescriptionChars) {
    return { error: `The description is ${description.length} characters, the limit is ${maxDescriptionChars} because it is sent with every request` };
  }
  if (!toSlug(name)) {
    return { error: `The name "${name}" contains no usable characters for a folder name` };
  }
  if (!body) {
    return { error: "SKILL.md has frontmatter but no body" };
  }
  return { name, description, body, meta };
};

const scanFolder = async (root, slug) => {
  const dir = path.join(root, slug);
  let raw = "";
  try {
    const stat = await fs.stat(path.join(dir, "SKILL.md"));
    if (stat.size > maxSkillBytes) {
      return { slug, error: `SKILL.md is ${stat.size} bytes, the limit is ${maxSkillBytes}` };
    }
    raw = await fs.readFile(path.join(dir, "SKILL.md"), "utf8");
  } catch {
    return { slug, error: "no SKILL.md in this folder" };
  }
  const parsed = parseSkillFile(raw);
  if (parsed.error) {
    return { slug, error: parsed.error };
  }
  let files = [];
  try {
    files = (await fs.readdir(dir, { withFileTypes: true })).filter((entry) => entry.isFile()).map((entry) => entry.name);
  } catch {}
  return {
    slug,
    name: parsed.name,
    description: parsed.description,
    body: parsed.body,
    bytes: Buffer.byteLength(raw, "utf8"),
    sha256: sha256(raw),
    files: files.filter((file) => file.toLowerCase() !== "skill.md"),
  };
};

const readRegistry = async () => {
  try {
    const parsed = JSON.parse(await fs.readFile(registryFile(), "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeRegistry = async (registry) => {
  await fs.mkdir(skillsRoot(), { recursive: true });
  await fs.writeFile(registryFile(), `${JSON.stringify(registry, null, 2)}\n`, "utf8");
};

const fetchText = async (url, accept) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), fetchTimeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "VantheaX", Accept: accept || "text/plain" },
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText} for ${url}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
};

const githubApi = async (owner, repo, dirPath, ref) => {
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${dirPath.split("/").filter(Boolean).map(encodeURIComponent).join("/")}${query}`;
  const text = await fetchText(url, "application/vnd.github+json");
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : [parsed];
};

const resolveGithub = async (url) => {
  const parts = url.pathname.split("/").filter(Boolean);
  const [owner, repo, kind, ...rest] = parts;
  if (!owner || !repo) {
    return { error: "This GitHub URL has no owner and repository" };
  }
  if (kind !== "tree" && kind !== "blob") {
    const entries = await githubApi(owner, repo, "", "");
    return { owner, repo, ref: "", dir: "", entries };
  }
  const ref = rest[0] || "";
  let dir = rest.slice(1).join("/");
  if (kind === "blob") {
    if (!dir.toLowerCase().endsWith("skill.md")) {
      return { error: "A blob URL must point at a SKILL.md" };
    }
    dir = dir.split("/").slice(0, -1).join("/");
  }
  const entries = await githubApi(owner, repo, dir, ref);
  return { owner, repo, ref, dir, entries };
};

const prepareFromGithub = async (url) => {
  const resolved = await resolveGithub(url);
  if (resolved.error) {
    return resolved;
  }
  const files = resolved.entries.filter((entry) => entry && entry.type === "file");
  const main = files.find((entry) => String(entry.name).toLowerCase() === "skill.md");
  if (!main) {
    return { error: `No SKILL.md in ${resolved.dir || "the repository root"}. Point the URL at the folder that contains SKILL.md.` };
  }
  if (main.size > maxSkillBytes) {
    return { error: `SKILL.md is ${main.size} bytes, the limit is ${maxSkillBytes}` };
  }
  const executables = files.filter((entry) => executableExtensions.has(path.extname(entry.name).toLowerCase()));
  if (executables.length) {
    return { error: `This skill ships executable files (${executables.map((entry) => entry.name).join(", ")}). Skills with executable content are not supported yet, only SKILL.md and plain documents.` };
  }
  const raw = await fetchText(main.download_url, "text/plain");
  const parsed = parseSkillFile(raw);
  if (parsed.error) {
    return { error: parsed.error };
  }
  const extras = [];
  for (const entry of files) {
    if (String(entry.name).toLowerCase() === "skill.md" || extras.length >= maxExtraFiles) {
      continue;
    }
    if (!/\.(md|markdown|txt|json|ya?ml)$/i.test(entry.name) || entry.size > maxSkillBytes) {
      continue;
    }
    extras.push({ name: entry.name, content: await fetchText(entry.download_url, "text/plain") });
  }
  return {
    name: parsed.name,
    description: parsed.description,
    body: parsed.body,
    raw,
    extras,
    source: url.href,
    ref: resolved.ref || "",
    commit: String(main.sha || ""),
    sha256: sha256(raw),
  };
};

const prepareFromUrl = async (url) => {
  if (!/\.(md|markdown)$/i.test(url.pathname)) {
    return { error: "A direct URL must point at a SKILL.md file" };
  }
  const raw = await fetchText(url.href, "text/plain");
  const parsed = parseSkillFile(raw);
  if (parsed.error) {
    return { error: parsed.error };
  }
  return {
    name: parsed.name,
    description: parsed.description,
    body: parsed.body,
    raw,
    extras: [],
    source: url.href,
    ref: "",
    commit: "",
    sha256: sha256(raw),
  };
};

const prepareFromPath = async (source) => {
  const stat = await fs.stat(source).catch(() => null);
  if (!stat) {
    return { error: `No such path: ${source}` };
  }
  const file = stat.isDirectory() ? path.join(source, "SKILL.md") : source;
  if (path.basename(file).toLowerCase() !== "skill.md") {
    return { error: "A local path must be a skill folder or its SKILL.md" };
  }
  const raw = await fs.readFile(file, "utf8").catch(() => "");
  if (!raw) {
    return { error: `Could not read ${file}` };
  }
  const parsed = parseSkillFile(raw);
  if (parsed.error) {
    return { error: parsed.error };
  }
  const dir = path.dirname(file);
  const names = (await fs.readdir(dir, { withFileTypes: true }).catch(() => [])).filter((entry) => entry.isFile()).map((entry) => entry.name);
  const executables = names.filter((name) => executableExtensions.has(path.extname(name).toLowerCase()));
  if (executables.length) {
    return { error: `This skill folder contains executable files (${executables.join(", ")}). Skills with executable content are not supported yet.` };
  }
  const extras = [];
  for (const name of names) {
    if (name.toLowerCase() === "skill.md" || extras.length >= maxExtraFiles || !/\.(md|markdown|txt|json|ya?ml)$/i.test(name)) {
      continue;
    }
    const size = (await fs.stat(path.join(dir, name)).catch(() => null))?.size || 0;
    if (size > maxSkillBytes) {
      continue;
    }
    extras.push({ name, content: await fs.readFile(path.join(dir, name), "utf8").catch(() => "") });
  }
  return {
    name: parsed.name,
    description: parsed.description,
    body: parsed.body,
    raw,
    extras: extras.filter((entry) => entry.content),
    source: dir,
    ref: "",
    commit: "",
    sha256: sha256(raw),
  };
};

export const createSkillStore = () => {
  let entries = [];
  let disabled = new Set();
  let commitSeq = 0;

  const refresh = async () => {
    const root = skillsRoot();
    let dirs = [];
    try {
      dirs = (await fs.readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).map((entry) => entry.name);
    } catch {
      entries = [];
      return entries;
    }
    const registry = await readRegistry();
    const scanned = [];
    for (const slug of dirs.slice(0, maxSkills)) {
      const entry = await scanFolder(root, slug);
      const install = registry[slug] || {};
      scanned.push({
        ...entry,
        source: install.source || "",
        ref: install.ref || "",
        commit: install.commit || "",
        installedAt: install.installedAt || "",
      });
    }
    scanned.sort((a, b) => String(a.name || a.slug).localeCompare(String(b.name || b.slug)));
    entries = scanned;
    return entries;
  };

  const isEnabled = (entry) => !entry.error && !disabled.has(entry.slug.toLowerCase());
  const usable = () => entries.filter(isEnabled);

  const find = (name) => {
    const wanted = String(name || "").trim().toLowerCase();
    if (!wanted) {
      return null;
    }
    return usable().find((entry) => entry.name.toLowerCase() === wanted || entry.slug.toLowerCase() === toSlug(wanted)) || null;
  };

  const commit = async (prepared, slugOverride) => {
    const slug = toSlug(slugOverride || prepared.name);
    if (!slug) {
      return { error: "Could not derive a folder name from the skill name" };
    }
    const root = skillsRoot();
    const target = path.join(root, slug);
    commitSeq += 1;
    const staging = path.join(root, `.staging-${slug}-${process.pid}-${commitSeq}`);
    const backup = path.join(root, `.backup-${slug}-${process.pid}-${commitSeq}`);
    await fs.mkdir(root, { recursive: true });
    await fs.rm(staging, { recursive: true, force: true });
    await fs.mkdir(staging, { recursive: true });
    let backedUp = false;
    try {
      await fs.writeFile(path.join(staging, "SKILL.md"), prepared.raw, "utf8");
      for (const extra of prepared.extras || []) {
        const safe = path.basename(String(extra.name || ""));
        if (!safe || safe.startsWith(".")) {
          continue;
        }
        await fs.writeFile(path.join(staging, safe), String(extra.content || ""), "utf8");
      }
      backedUp = await fs.rename(target, backup).then(() => true).catch(() => false);
      await fs.rename(staging, target);
      if (backedUp) {
        await fs.rm(backup, { recursive: true, force: true }).catch(() => {});
      }
    } catch (error) {
      if (backedUp) {
        await fs.rename(backup, target).catch(() => {});
      }
      await fs.rm(staging, { recursive: true, force: true }).catch(() => {});
      await refresh();
      return { error: String(error?.message || error) };
    }
    try {
      const registry = await readRegistry();
      registry[slug] = {
        source: prepared.source || "",
        ref: prepared.ref || "",
        commit: prepared.commit || "",
        sha256: prepared.sha256 || "",
        installedAt: new Date().toISOString(),
      };
      await writeRegistry(registry);
    } catch {}
    await refresh();
    return { installed: true, slug, name: prepared.name, description: prepared.description };
  };

  let writeChain = Promise.resolve();
  const queued = (task) => {
    const next = writeChain.then(task, task);
    writeChain = next.then(() => {}, () => {});
    return next;
  };
  const queuedCommit = (prepared, slugOverride) => queued(() => commit(prepared, slugOverride));

  return {
    refresh,
    folder: () => skillsRoot(),
    setDisabled: (list) => {
      disabled = new Set((Array.isArray(list) ? list : []).map((item) => String(item || "").toLowerCase()).filter(Boolean));
    },
    list: () => usable().map((entry) => ({ slug: entry.slug, name: entry.name, description: entry.description })),
    all: () => entries.map((entry) => ({
      slug: entry.slug,
      name: entry.name || entry.slug,
      description: entry.description || "",
      bytes: entry.bytes || 0,
      files: entry.files || [],
      source: entry.source || "",
      ref: entry.ref || "",
      commit: entry.commit || "",
      installedAt: entry.installedAt || "",
      error: entry.error || "",
      enabled: isEnabled(entry),
    })),
    names: () => entries.map((entry) => entry.name || entry.slug),
    body: (name) => {
      const entry = find(name);
      if (!entry) {
        return null;
      }
      return { slug: entry.slug, name: entry.name, description: entry.description, body: entry.body, files: entry.files, folder: path.join(skillsRoot(), entry.slug) };
    },
    bodyBySlug: async (slug) => {
      const entry = entries.find((item) => item.slug === String(slug || ""));
      if (!entry) {
        return null;
      }
      const raw = await fs.readFile(path.join(skillsRoot(), entry.slug, "SKILL.md"), "utf8").catch(() => "");
      return { slug: entry.slug, name: entry.name || entry.slug, raw };
    },
    prepare: async (source) => {
      const value = String(source || "").trim();
      if (!value) {
        return { error: "No source given" };
      }
      let url = null;
      try {
        url = new URL(value);
      } catch {}
      try {
        if (url && (url.protocol === "http:" || url.protocol === "https:")) {
          return url.hostname === "github.com" ? await prepareFromGithub(url) : await prepareFromUrl(url);
        }
        return await prepareFromPath(value);
      } catch (error) {
        return { error: String(error?.message || error) };
      }
    },
    commit: queuedCommit,
    remove: (slug) => queued(async () => {
      const safe = String(slug || "");
      if (!safe || !entries.some((entry) => entry.slug === safe)) {
        return { error: "Unknown skill" };
      }
      try {
        await fs.rm(path.join(skillsRoot(), safe), { recursive: true, force: true });
        const registry = await readRegistry();
        delete registry[safe];
        await writeRegistry(registry);
      } catch (error) {
        await refresh();
        return { error: String(error?.message || error) };
      }
      await refresh();
      return { removed: true };
    }),
  };
};
