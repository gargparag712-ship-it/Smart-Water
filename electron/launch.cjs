const { spawn } = require('node:child_process');

// Some development tools set this flag globally to run Electron's binary as Node.
// Remove it only for the Electron child process so the desktop main process starts normally.
const childEnvironment = { ...process.env };
delete childEnvironment.ELECTRON_RUN_AS_NODE;

const electronBinary = require('electron');
const child = spawn(electronBinary, ['.', ...process.argv.slice(2)], {
  env: childEnvironment,
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error('Could not start the Electron application:', error.message);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
