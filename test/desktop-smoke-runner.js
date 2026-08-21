'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PROFILE_PREFIX = 'kompliance-desktop-smoke-';
const PASS_MARKER = '[DesktopSmoke] PASS ';
const TIMEOUT_MS = 60000;

const projectRoot = path.resolve(__dirname, '..');
const electronPath = require('electron');
const smokeProfile = fs.mkdtempSync(path.join(os.tmpdir(), PROFILE_PREFIX));

let output = '';
let finished = false;
let forceExitTimer = null;

function appendOutput(chunk, target) {
  const text = chunk.toString();
  target.write(text);
  output = (output + text).slice(-50000);
}

function cleanupProfile() {
  const resolved = path.resolve(smokeProfile);
  const parent = path.dirname(resolved);
  const safe = parent === path.resolve(os.tmpdir())
    && path.basename(resolved).startsWith(PROFILE_PREFIX);

  if (!safe) {
    throw new Error(`Refusing to remove unexpected smoke path: ${resolved}`);
  }

  fs.rmSync(resolved, { recursive: true, force: true });
}

function finish(code, message) {
  if (finished) return;
  finished = true;
  if (forceExitTimer) clearTimeout(forceExitTimer);

  try {
    cleanupProfile();
  } catch (error) {
    console.error(`[DesktopSmokeRunner] Cleanup failed: ${error.message}`);
    code = 1;
  }

  if (message) {
    const log = code === 0 ? console.log : console.error;
    log(`[DesktopSmokeRunner] ${message}`);
  }

  process.exitCode = code;
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
env.KOMPLIANCE_DESKTOP_SMOKE = '1';
env.KOMPLIANCE_DESKTOP_SMOKE_DIR = smokeProfile;
env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

const child = spawn(electronPath, ['.'], {
  cwd: projectRoot,
  env,
  shell: false,
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});

child.stdout.on('data', chunk => appendOutput(chunk, process.stdout));
child.stderr.on('data', chunk => appendOutput(chunk, process.stderr));

child.on('error', error => {
  finish(1, `Electron failed to start: ${error.message}`);
});

const timeout = setTimeout(() => {
  console.error(`[DesktopSmokeRunner] Timed out after ${TIMEOUT_MS / 1000}s`);
  child.kill();
  forceExitTimer = setTimeout(() => {
    finish(1, 'Electron did not exit after timeout');
  }, 5000);
}, TIMEOUT_MS);

child.on('close', code => {
  clearTimeout(timeout);
  const passed = code === 0 && output.includes(PASS_MARKER);

  if (passed) {
    finish(0, 'Bootstrap and navigation smoke passed');
    return;
  }

  const reason = output.includes('[DesktopSmoke] FAIL ')
    ? 'Application reported a smoke failure'
    : `Electron exited with code ${code} without the pass marker`;
  finish(1, reason);
});
