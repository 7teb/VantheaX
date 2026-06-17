import { spawn } from "node:child_process";
import { createServer } from "node:net";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isPortOpen = () =>
  new Promise((resolve) => {
    const socket = createServer();
    socket.once("error", () => resolve(true));
    socket.once("listening", () => {
      socket.close(() => resolve(false));
    });
    socket.listen(5173, "127.0.0.1");
  });

const vite = spawn("npx.cmd", ["vite", "--host", "127.0.0.1", "--port", "5173", "--strictPort"], {
  stdio: "inherit",
  shell: true,
});

while (!(await isPortOpen())) {
  await wait(250);
}

const electron = spawn("npx.cmd", ["electron", "."], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: "http://127.0.0.1:5173",
  },
});

const stop = () => {
  electron.kill();
  vite.kill();
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
electron.on("exit", stop);
