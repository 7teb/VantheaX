import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const imageSafeName = /^img_[a-z0-9]+_[a-z0-9]+\.[a-z]+$/;
const maxImageBytes = 20 * 1024 * 1024;

const imageKindFromMagic = (buf) => {
  if (!buf || buf.length < 12) {
    return null;
  }
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { ext: "png", mime: "image/png" };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { ext: "gif", mime: "image/gif" };
  }
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
    return { ext: "webp", mime: "image/webp" };
  }
  if (buf[0] === 0x42 && buf[1] === 0x4d) {
    return { ext: "bmp", mime: "image/bmp" };
  }
  return null;
};

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
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vx-img-rt-"));
  const save = async (dataUrl) => {
    const raw = String(dataUrl || "");
    const comma = raw.indexOf(",");
    const b64 = comma >= 0 ? raw.slice(comma + 1) : raw;
    const buf = Buffer.from(b64, "base64");
    if (!buf.length) {
      throw new Error("Empty image data");
    }
    if (buf.length > maxImageBytes) {
      throw new Error("Image exceeds the 20 MB limit");
    }
    const kind = imageKindFromMagic(buf);
    if (!kind) {
      throw new Error("Not a recognized image");
    }
    const name = `img_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}.${kind.ext}`;
    await fs.writeFile(path.join(dir, name), buf, { flag: "wx" });
    return { name, buf };
  };

  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("0123456789abcdef", "utf8")]);
  const saved = await save(`data:image/png;base64,${png.toString("base64")}`);
  ok(imageSafeName.test(saved.name), "saved name matches the safe regex");
  ok(saved.name.endsWith(".png"), "extension derived from magic bytes is png");
  const back = await fs.readFile(path.join(dir, saved.name));
  ok(Buffer.compare(back, png) === 0, "roundtrip bytes are identical");

  let tooBig = false;
  try {
    const big = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(maxImageBytes)]);
    await save(`data:image/png;base64,${big.toString("base64")}`);
  } catch {
    tooBig = true;
  }
  ok(tooBig, "a payload over 20 MB is rejected");

  let notImage = false;
  try {
    await save(`data:image/png;base64,${Buffer.from("this is definitely not an image at all", "utf8").toString("base64")}`);
  } catch {
    notImage = true;
  }
  ok(notImage, "a non-image declared as image/png is rejected by the magic-byte check");

  await fs.rm(dir, { recursive: true, force: true });
  console.log(`image-roundtrip: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
};

run();
