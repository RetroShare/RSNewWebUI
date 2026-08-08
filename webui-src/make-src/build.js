'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const shellScript = path.join(__dirname, 'build.sh');
const batchScript = path.join(__dirname, 'build.bat');

function getRunner(platform, commandShell = 'cmd.exe') {
  return platform === 'win32'
    ? { command: commandShell, args: ['/d', '/c', batchScript] }
    : { command: 'sh', args: [shellScript] };
}

function run(runner) {
  const result = spawnSync(runner.command, runner.args, { stdio: 'inherit' });
  if (result.error) {
    console.error(result.error.message);
    return 1;
  }
  return result.status ?? 1;
}

if (process.argv[2] === '--check') {
  assert.equal(path.basename(getRunner('win32').args[2]), 'build.bat');
  assert.equal(path.basename(getRunner('linux').args[0]), 'build.sh');
  const status = process.platform === 'win32'
    ? 0
    : run({ command: 'sh', args: ['-n', shellScript] });
  if (status === 0) console.log('Build dispatcher checks passed.');
  process.exitCode = status;
} else {
  process.exitCode = run(getRunner(process.platform, process.env.ComSpec));
}
