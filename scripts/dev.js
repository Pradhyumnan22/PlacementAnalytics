const { spawn } = require("child_process");

function run(name, command, args) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: true,
  });

  child.on("exit", (code) => {
    if (code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
    }
  });

  return child;
}

const backend = run("backend", "npm", ["run", "dev:backend"]);
const frontend = run("frontend", "npm", ["run", "dev:frontend"]);

function shutdown() {
  backend.kill();
  frontend.kill();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
