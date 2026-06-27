import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const imageSafeName = /^img_[a-z0-9]+_[a-z0-9]+\.[a-z]+$/;

let pass = 0;
let fail = 0;
const ok = (cond, msg) => {
  if (cond) {
    pass += 1;
  } else {
    fail += 1;
    console.log("FAIL:", msg);
  }
};

const run = async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vx-img-path-"));
  const resolveImagePath = async (name) => {
    const base = path.basename(String(name || ""));
    if (!imageSafeName.test(base)) {
      throw new Error("Invalid image name");
    }
    const root = await fs.realpath(dir);
    const real = await fs.realpath(path.join(root, base));
    const rel = path.relative(root, real);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new Error("escape");
    }
    return real;
  };

  const valid = "img_abc123_def456.png";
  await fs.writeFile(path.join(dir, valid), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  try {
    const r = await resolveImagePath(valid);
    ok(r === await fs.realpath(path.join(dir, valid)), "valid name resolves inside images dir");
  } catch {
    ok(false, "valid name was rejected");
  }

  const bads = ["../escape.png", "..\\escape.png", "/etc/passwd", "C:\\Windows\\x.png", "img_x.png", "evil.txt", "img_a_b.png\0", "img_a_b.exe; rm -rf /", "img_A_B.png", ""];
  for (const bad of bads) {
    let threw = false;
    try {
      await resolveImagePath(bad);
    } catch {
      threw = true;
    }
    ok(threw, `rejected ${JSON.stringify(bad)}`);
  }

  let neutralized = true;
  try {
    const r = await resolveImagePath("../../img_abc123_def456.png");
    neutralized = r === await fs.realpath(path.join(dir, valid));
  } catch {
    neutralized = false;
  }
  ok(neutralized, "traversal with a valid basename is neutralized to the in-dir file, never escapes");

  await fs.rm(dir, { recursive: true, force: true });
  console.log(`image-path: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
};

run();
