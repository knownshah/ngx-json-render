// Packs the MCP App's ChatGPT plugin into dist/chatgpt-plugin.zip, the file
// uploaded at platform.openai.com/plugins:
//
//   plugin.json         listing, review test cases and publication settings
//   mcp.json            the hosted MCP server
//   assets/icon.png     the 512 px icon the docs pages already publish
//
// Before zipping it checks the limits OpenAI enforces at submission, since an
// upload accepts a package that the Submit step then rejects.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const source = join('projects', 'mcp-app', 'chatgpt-plugin');
const staging = join('dist', 'chatgpt-plugin');
const zip = resolve('dist', 'chatgpt-plugin.zip');

const manifest = JSON.parse(readFileSync(join(source, 'plugin.json'), 'utf8'));
const openai = manifest.extensions['com.openai'];
const ui = openai.interface;
const cases = openai.review.test_cases;

const problems = [];
const atMost = (label, value, max) => {
  if (typeof value !== 'string' || !value.trim()) {
    problems.push(`${label} is empty`);
  } else if (value.length > max) {
    problems.push(`${label} is ${value.length} characters, at most ${max}`);
  }
};
atMost('name', manifest.name, 64);
atMost('displayName', ui.displayName, 30);
atMost('shortDescription', ui.shortDescription, 30);
atMost('longDescription', ui.longDescription, 4000);
atMost('developerName', ui.developerName, 80);
if (/\b(mcp|plugin)\b/i.test(ui.displayName)) {
  problems.push('displayName must not say "MCP" or "Plugin"');
}
if (ui.defaultPrompt.length > 3) problems.push('more than 3 defaultPrompt');
ui.defaultPrompt.forEach((prompt, i) => {
  atMost(`defaultPrompt[${i}]`, prompt, 128);
  if (prompt.includes('@')) problems.push(`defaultPrompt[${i}] has an @`);
});
for (const key of [
  'websiteURL',
  'supportURL',
  'privacyPolicyURL',
  'termsOfServiceURL',
]) {
  if (!ui[key]?.startsWith('https://')) problems.push(`${key} is not HTTPS`);
}
if (cases.positive.length !== 5) problems.push('need exactly 5 positive cases');
if (cases.negative.length !== 3) problems.push('need exactly 3 negative cases');
cases.positive.forEach((c, i) => {
  for (const key of ['description', 'prompt', 'tools_triggered']) {
    atMost(`positive[${i}].${key}`, c[key], 4000);
  }
  atMost(`positive[${i}].expected_behavior`, c.expected_behavior, 4000);
});
if (problems.length) {
  console.error(`pack-chatgpt-plugin:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

rmSync(staging, { recursive: true, force: true });
rmSync(zip, { force: true });
mkdirSync(join(staging, 'assets'), { recursive: true });
cpSync(join(source, 'plugin.json'), join(staging, 'plugin.json'));
cpSync(join(source, 'mcp.json'), join(staging, 'mcp.json'));
cpSync(
  join('projects', 'demo', 'public', 'mcp', 'icon-512.png'),
  join(staging, 'assets', 'icon.png'),
);
execFileSync('zip', ['-r', '-X', zip, '.'], { cwd: staging, stdio: 'ignore' });

if (!openai.review.demo_recording_url) {
  console.warn(
    'No review.demo_recording_url: add the video URL here or in the dashboard before submitting.',
  );
}
console.log(`Packed ${zip}`);
