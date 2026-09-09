import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const security = fs.readFileSync(new URL('../SECURITY.md', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const questions = fs.readFileSync(new URL('../questoes-data.js', import.meta.url), 'utf8');

const repositoryText = [app, readme, security, index, questions].join('\n');

test('repository does not contain common committed credential patterns', () => {
  const patterns = [
    /github_pat_[A-Za-z0-9_]{20,}/,
    /ghp_[A-Za-z0-9]{20,}/,
    /AIza[0-9A-Za-z_-]{20,}/,
    /sk-[A-Za-z0-9_-]{24,}/,
  ];
  for (const pattern of patterns) {
    assert.doesNotMatch(repositoryText, pattern);
  }
});

test('documentation explicitly reflects current persistent-secret risk', () => {
  assert.match(app, /localStorage\.getItem\(LS_TOKEN\)/);
  assert.match(app, /localStorage\.setItem\(LS_AI/);
  assert.match(readme, /persisted in browser `localStorage`/i);
  assert.match(security, /persists:[\s\S]*GitHub Gist token[\s\S]*AI provider keys/i);
});

test('study-data sync block does not include AI key configuration', () => {
  const syncStart = app.indexOf('2. SINCRONIZAÇÃO');
  const aiStart = app.indexOf('3. IA');
  assert.ok(syncStart >= 0 && aiStart > syncStart, 'sync and AI sections should remain identifiable');
  const syncBlock = app.slice(syncStart, aiStart);
  assert.doesNotMatch(syncBlock, /geminiKey|apiKey|LS_AI/);
  assert.match(syncBlock, /JSON\.stringify\(DATA\)/);
});

test('PWA offline contract remains present', () => {
  assert.match(index, /manifest\.json/);
  assert.match(index, /serviceWorker/i);
  assert.ok(fs.existsSync(new URL('../sw.js', import.meta.url)));
  assert.ok(fs.existsSync(new URL('../manifest.json', import.meta.url)));
});
