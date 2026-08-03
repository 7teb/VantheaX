import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { brotliCompress, brotliDecompress, constants as zlibConstants } from "node:zlib";

const version = 2;
const maxSearchChars = 120000;
const compress = promisify(brotliCompress);
const decompress = promisify(brotliDecompress);

const readJson = async (file, fallback) => {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
};

const writeJson = async (file, value) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${Date.now()}-${Math.random().toString(16).slice(2, 8)}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(value, null, 2), "utf8");
    await fs.rename(temporary, file);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
};

const writeBuffer = async (file, value) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${Date.now()}-${Math.random().toString(16).slice(2, 8)}.tmp`;
  try {
    await fs.writeFile(temporary, value);
    await fs.rename(temporary, file);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
};

const cleanChat = (chat) => {
  const value = { ...(chat || {}) };
  delete value.messagesLoaded;
  delete value.searchText;
  delete value.messageCount;
  return value;
};

const searchableText = (chat) => {
  const parts = [chat?.title, chat?.projectPath];
  for (const message of chat?.messages || []) {
    if (message?.content) {
      parts.push(message.content);
    }
  }
  return parts.filter(Boolean).join(" ").slice(0, maxSearchChars);
};

const metadataFor = (chat) => ({
  id: String(chat?.id || ""),
  projectPath: String(chat?.projectPath || ""),
  workspaceName: String(chat?.workspaceName || ""),
  pinned: Boolean(chat?.pinned),
  title: String(chat?.title || "New chat"),
  summaryCount: Number(chat?.summaryCount) || 0,
  createdAt: String(chat?.createdAt || new Date().toISOString()),
  updatedAt: String(chat?.updatedAt || new Date().toISOString()),
  messageCount: Array.isArray(chat?.messages) ? chat.messages.length : Number(chat?.messageCount) || 0,
  searchText: searchableText(chat),
});

const publicMetadata = (entry) => ({
  ...entry,
  messages: [],
  summary: "",
  messagesLoaded: false,
});

const streamJsonArray = async (file, onValue) => {
  const stream = createReadStream(file, { encoding: "utf8", highWaterMark: 64 * 1024 });
  let capturing = false;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let parts = [];
  for await (const chunk of stream) {
    let segmentStart = capturing ? 0 : -1;
    for (let index = 0; index < chunk.length; index += 1) {
      const char = chunk[index];
      if (!capturing) {
        if (char === "{") {
          capturing = true;
          depth = 1;
          inString = false;
          escaped = false;
          segmentStart = index;
        }
        continue;
      }
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === "\"") {
          inString = false;
        }
        continue;
      }
      if (char === "\"") {
        inString = true;
        continue;
      }
      if (char === "{" || char === "[") {
        depth += 1;
        continue;
      }
      if (char !== "}" && char !== "]") {
        continue;
      }
      depth -= 1;
      if (depth !== 0) {
        continue;
      }
      parts.push(chunk.slice(segmentStart, index + 1));
      await onValue(JSON.parse(parts.join("")));
      capturing = false;
      parts = [];
      segmentStart = -1;
    }
    if (capturing && segmentStart >= 0) {
      parts.push(chunk.slice(segmentStart));
    }
  }
  if (capturing || depth !== 0 || inString) {
    throw new Error("Legacy chat file is incomplete.");
  }
};

export const createChatStore = ({ directory, legacyFile, backupFile }) => {
  const chatsDirectory = path.join(directory, "data-v2");
  const indexFile = path.join(directory, "index.json");
  const entries = new Map();
  let writeChain = Promise.resolve();

  const fileFor = (id) => path.join(chatsDirectory, `${createHash("sha256").update(String(id)).digest("hex")}.vxchat`);

  const serializeIndex = () => ({
    version,
    chats: [...entries.values()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))),
  });

  const persistIndex = async () => await writeJson(indexFile, serializeIndex());

  const queue = (operation) => {
    const run = writeChain.then(operation, operation);
    writeChain = run.then(() => {}, () => {});
    return run;
  };

  const saveDirect = async (chat) => {
    const clean = cleanChat(chat);
    const id = String(clean.id || "");
    if (!id) {
      throw new Error("Chat id is required.");
    }
    const packed = await compress(Buffer.from(JSON.stringify(clean), "utf8"), {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 4,
      },
    });
    await writeBuffer(fileFor(id), packed);
    entries.set(id, metadataFor(clean));
  };

  const readChat = async (id) => {
    try {
      const packed = await fs.readFile(fileFor(id));
      const content = await decompress(packed);
      return JSON.parse(content.toString("utf8"));
    } catch {
      return null;
    }
  };

  const migrate = async () => {
    try {
      const stat = await fs.stat(legacyFile);
      if (!stat.isFile() || stat.size < 2) {
        await persistIndex();
        return;
      }
    } catch {
      await persistIndex();
      return;
    }
    try {
      await fs.access(backupFile);
    } catch {
      await fs.copyFile(legacyFile, backupFile);
    }
    let count = 0;
    await streamJsonArray(legacyFile, async (chat) => {
      if (chat?.id && count < 1000) {
        count += 1;
        await saveDirect(chat);
      }
    });
    await persistIndex();
  };

  const initialize = async () => {
    await fs.mkdir(chatsDirectory, { recursive: true });
    const stored = await readJson(indexFile, null);
    if (!stored || stored.version !== version || !Array.isArray(stored.chats)) {
      await migrate();
      return;
    }
    for (const entry of stored.chats) {
      if (entry?.id) {
        entries.set(String(entry.id), {
          ...entry,
          id: String(entry.id),
          searchText: String(entry.searchText || ""),
          messageCount: Number(entry.messageCount) || 0,
        });
      }
    }
  };

  const get = async (id) => {
    const key = String(id || "");
    if (!entries.has(key)) {
      return null;
    }
    const chat = await readChat(key);
    return chat ? { ...chat, messagesLoaded: true, searchText: entries.get(key)?.searchText || "" } : null;
  };

  const list = async (activeId = "") => {
    const values = [...entries.values()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const selected = entries.has(String(activeId || "")) ? String(activeId) : values[0]?.id || "";
    const active = selected ? await get(selected) : null;
    return values.map((entry) => entry.id === selected && active ? active : publicMetadata(entry));
  };

  const save = async (chat) => await queue(async () => {
    await saveDirect(chat);
    await persistIndex();
    return publicMetadata(entries.get(String(chat.id)));
  });

  const importChats = async (chats) => await queue(async () => {
    for (const chat of Array.isArray(chats) ? chats.slice(0, 1000) : []) {
      if (chat?.id) {
        await saveDirect(chat);
      }
    }
    await persistIndex();
    return true;
  });

  const remove = async (id) => await queue(async () => {
    const key = String(id || "");
    if (!entries.delete(key)) {
      return false;
    }
    await fs.rm(fileFor(key), { force: true });
    await persistIndex();
    return true;
  });

  const attachmentNames = async () => {
    const names = new Set();
    for (const id of entries.keys()) {
      const chat = await readChat(id);
      for (const message of chat?.messages || []) {
        if (message?.attachment?.name) {
          names.add(message.attachment.name);
        }
        for (const attachment of Array.isArray(message?.attachments) ? message.attachments : []) {
          if (attachment?.name) {
            names.add(attachment.name);
          }
        }
      }
    }
    return names;
  };

  return {
    initialize,
    list,
    get,
    save,
    importChats,
    remove,
    attachmentNames,
  };
};
