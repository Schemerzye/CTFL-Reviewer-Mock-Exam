#!/usr/bin/env node
/* <CTFL-Reviewer-Mock-Exam>
 * verify.js — run structural + length-balance checks on the question bank.
 * Exit code 0 = pass, 1 = fail. Safe to run in CI.
 * Usage: node verify.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.log('FAIL: <script> block not found'); process.exit(1); }
const code = m[1].replace('const QUESTION_BANK=', 'globalThis.QUESTION_BANK=');
const ctx = { console, Math, Date };
vm.createContext(ctx);
new vm.Script(code).runInContext(ctx);
const bank = ctx.QUESTION_BANK;

const errors = [];

if (bank.length !== 414) errors.push('bank length = ' + bank.length + ' (expected 414)');

bank.forEach(q => {
  const expOpts = q.multi ? 5 : 4;
  if (q.o.length !== expOpts) errors.push('id ' + q.id + ': option count ' + q.o.length + ' (expected ' + expOpts + ')');
  if (!q.q) errors.push('id ' + q.id + ': missing question text');
  if (!q.ex) errors.push('id ' + q.id + ': missing explanation');
  if (new Set(q.o).size !== q.o.length) errors.push('id ' + q.id + ': duplicate option text');
  const cs = Array.isArray(q.c) ? q.c : [q.c];
  if (q.multi && (q.c.length !== 2 || !Array.isArray(q.c))) errors.push('id ' + q.id + ': multi correct must be a 2-element array');
  cs.forEach(i => { if (i < 0 || i >= q.o.length) errors.push('id ' + q.id + ': correct index out of range ' + i); });
});

// Length-balance: the correct answer must not be systematically identifiable by length.
let correctLongest = 0;
let severe = 0;
bank.forEach(q => {
  const cs = Array.isArray(q.c) ? q.c : [q.c];
  const cl = cs.map(i => q.o[i].length);
  const dl = q.o.map((o, i) => cs.includes(i) ? null : o.length).filter(x => x !== null);
  const avgC = cl.reduce((a, c) => a + c, 0) / cl.length;
  const maxD = Math.max(...dl);
  if (avgC > Math.max(...dl)) correctLongest++;
  if (avgC > maxD * 1.5) severe++;
});

if (correctLongest > bank.length * 0.45) {
  errors.push('correct-longest = ' + correctLongest + ' (' + Math.round(correctLongest / bank.length * 100) + '%) — exceeds 45% threshold (answer is guessable by length)');
}
if (severe > 2) {
  errors.push(severe + ' questions have the correct option >1.5x the longest distractor');
}

if (errors.length) {
  console.log('VERIFY FAILED (' + errors.length + '):');
  errors.forEach(e => console.log('  - ' + e));
  process.exit(1);
}
const pct = Math.round(correctLongest / bank.length * 100);
console.log('VERIFY PASSED — ' + bank.length + ' questions, correct-longest ' + correctLongest + ' (' + pct + '%), severe 1.5x: ' + severe);