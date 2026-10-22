#!/usr/bin/env node
/* <CTFL-Reviewer-Mock-Exam>
 * verify.js - structural, pool-composition, and exam-builder checks.
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

const EXPECTED_TOTAL = 574;
const CHAPTER_QUOTAS = [12, 9, 6, 17, 13, 3];
const CURRENT_BY_CHAPTER = [1, 3, 2, 15, 9, 0];
const NEW_BY_CHAPTER = [11, 6, 4, 2, 4, 3];
const CURRENT_MULTI_BY_CHAPTER = [1, 1, 0, 1, 1, 0];
const NEW_MULTI_BY_CHAPTER = [1, 1, 0, 1, 1, 0];

const errors = [];
const ids = new Map();
const stems = new Map();

if (bank.length !== EXPECTED_TOTAL) errors.push('bank length = ' + bank.length + ' (expected ' + EXPECTED_TOTAL + ')');

bank.forEach(q => {
  if (ids.has(q.id)) errors.push('duplicate id ' + q.id);
  ids.set(q.id, q);
  const expOpts = q.multi ? 5 : 4;
  if (!Array.isArray(q.o) || q.o.length !== expOpts) errors.push('id ' + q.id + ': option count ' + (q.o ? q.o.length : 'missing') + ' (expected ' + expOpts + ')');
  if (!q.q) errors.push('id ' + q.id + ': missing question text');
  if (!q.ex) errors.push('id ' + q.id + ': missing explanation');
  if (!q.ch || q.ch < 1 || q.ch > 6) errors.push('id ' + q.id + ': invalid chapter ' + q.ch);
  if (Array.isArray(q.o) && new Set(q.o).size !== q.o.length) errors.push('id ' + q.id + ': duplicate option text');
  if (Array.isArray(q.o) && q.o.some(o => /all of the above|none of the above|both a and b|both a and c/i.test(o))) errors.push('id ' + q.id + ': banned option phrase');
  const cs = Array.isArray(q.c) ? q.c : [q.c];
  if (q.multi) {
    if (!Array.isArray(q.c) || q.c.length !== 2) errors.push('id ' + q.id + ': multi correct must be a 2-element array');
  } else {
    if (Array.isArray(q.c) || cs.length !== 1) errors.push('id ' + q.id + ': single correct must be one index');
  }
  cs.forEach(i => { if (!Number.isInteger(i) || i < 0 || i >= (q.o ? q.o.length : 0)) errors.push('id ' + q.id + ': correct index out of range ' + i); });
  const key = (q.q || '').trim().toLowerCase();
  if (stems.has(key)) errors.push('duplicate question stem ids ' + stems.get(key) + ' and ' + q.id);
  else stems.set(key, q.id);

  if (q.diff === 'expert') {
    if (!['K1', 'K2', 'K3'].includes(q.k)) errors.push('id ' + q.id + ': expert item missing valid k level');
    if (!q.ref) errors.push('id ' + q.id + ': expert item missing syllabus ref');
    if ((q.q || '').length < 30) errors.push('id ' + q.id + ': expert stem is too short (' + (q.q || '').length + ' chars)');
  }
  if (q.id >= 700 && q.diff !== 'expert') errors.push('id ' + q.id + ': new item must have diff expert');
});

const current = bank.filter(q => !q.diff && (q.hard || q.multi));
const fresh = bank.filter(q => q.diff === 'expert');
const currentMulti = current.filter(q => q.multi);
const freshMulti = fresh.filter(q => q.multi);

if (current.length < 30) errors.push('current eligible pool = ' + current.length + ' (need at least 30)');
if (fresh.length < 30) errors.push('new expert pool = ' + fresh.length + ' (need at least 30)');
if (currentMulti.length < 8) errors.push('current multi-select pool = ' + currentMulti.length + ' (need at least 8)');
if (freshMulti.length < 8) errors.push('new multi-select pool = ' + freshMulti.length + ' (need at least 8)');

for (let ch = 1; ch <= 6; ch++) {
  const idx = ch - 1;
  const curCh = current.filter(q => q.ch === ch);
  const newCh = fresh.filter(q => q.ch === ch);
  const curMultiCh = curCh.filter(q => q.multi);
  const newMultiCh = newCh.filter(q => q.multi);
  if (curCh.length < CURRENT_BY_CHAPTER[idx]) errors.push('chapter ' + ch + ': current pool ' + curCh.length + ' < ' + CURRENT_BY_CHAPTER[idx]);
  if (newCh.length < NEW_BY_CHAPTER[idx]) errors.push('chapter ' + ch + ': new pool ' + newCh.length + ' < ' + NEW_BY_CHAPTER[idx]);
  if (curMultiCh.length < CURRENT_MULTI_BY_CHAPTER[idx]) errors.push('chapter ' + ch + ': current multi pool ' + curMultiCh.length + ' < ' + CURRENT_MULTI_BY_CHAPTER[idx]);
  if (newMultiCh.length < NEW_MULTI_BY_CHAPTER[idx]) errors.push('chapter ' + ch + ': new multi pool ' + newMultiCh.length + ' < ' + NEW_MULTI_BY_CHAPTER[idx]);
}

let correctLongest = 0;
const severeItems = [];
bank.forEach(q => {
  const cs = Array.isArray(q.c) ? q.c : [q.c];
  const cl = cs.map(i => q.o[i].length);
  const dl = q.o.map((o, i) => cs.includes(i) ? null : o.length).filter(x => x !== null);
  const avgC = cl.reduce((a, c) => a + c, 0) / cl.length;
  const maxD = Math.max(...dl);
  if (avgC > maxD) correctLongest++;
  if (avgC > maxD * 1.5) severeItems.push(q.id + ' (correct avg ' + avgC.toFixed(1) + ' vs max distractor ' + maxD + ')');
});

if (correctLongest > bank.length * 0.45) {
  errors.push('correct-longest = ' + correctLongest + ' (' + Math.round(correctLongest / bank.length * 100) + '%) - exceeds 45% threshold (answer is guessable by length)');
}
if (severeItems.length > 0) {
  errors.push(severeItems.length + ' questions have the correct option >1.5x the longest distractor: ' + severeItems.join(', '));
}

const api = ctx.__CTFL__;
if (!api || typeof api.buildExam !== 'function') {
  errors.push('exam builder is not exposed');
} else {
  if (api.examConfig.total !== 60) errors.push('examConfig.total = ' + api.examConfig.total + ' (expected 60)');
  if (api.examConfig.minutes !== 60) errors.push('examConfig.minutes = ' + api.examConfig.minutes + ' (expected 60)');
  if (api.examConfig.passPercent !== 60) errors.push('examConfig.passPercent = ' + api.examConfig.passPercent + ' (expected 60)');
  if (api.examConfig.selectTwo !== 8) errors.push('examConfig.selectTwo = ' + api.examConfig.selectTwo + ' (expected 8)');
  if (JSON.stringify(api.chapterQuotas) !== JSON.stringify(CHAPTER_QUOTAS)) errors.push('chapter quotas do not match verify.js');

  for (let run = 0; run < 1000; run++) {
    let exam;
    try {
      exam = api.buildExam();
    } catch (e) {
      errors.push('buildExam run ' + run + ' failed: ' + e.message);
      break;
    }
    if (exam.length !== 60) { errors.push('run ' + run + ': exam length ' + exam.length + ' != 60'); break; }
    const examIds = new Set(exam.map(q => q.id));
    if (examIds.size !== exam.length) { errors.push('run ' + run + ': duplicate ids in exam'); break; }
    const chapterCounts = [0, 0, 0, 0, 0, 0];
    exam.forEach(q => chapterCounts[q.ch - 1]++);
    if (JSON.stringify(chapterCounts) !== JSON.stringify(CHAPTER_QUOTAS)) { errors.push('run ' + run + ': chapter counts ' + chapterCounts.join('/') + ' != ' + CHAPTER_QUOTAS.join('/')); break; }
    const multi = exam.filter(q => q.multi).length;
    if (multi !== 8) { errors.push('run ' + run + ': select-two count ' + multi + ' != 8'); break; }
    const currentCount = exam.filter(q => !q.diff).length;
    const newCount = exam.filter(q => q.diff === 'expert').length;
    if (currentCount !== 30 || newCount !== 30) { errors.push('run ' + run + ': mix ' + currentCount + '/' + newCount + ' != 30/30'); break; }
    const currentMultiCount = exam.filter(q => !q.diff && q.multi).length;
    const newMultiCount = exam.filter(q => q.diff === 'expert' && q.multi).length;
    if (currentMultiCount !== 4 || newMultiCount !== 4) { errors.push('run ' + run + ': multi mix ' + currentMultiCount + '/' + newMultiCount + ' != 4/4'); break; }
    if (exam.some(q => !q.diff && !(q.hard || q.multi))) { errors.push('run ' + run + ': exam contains an easy current item'); break; }
    for (const q of exam) {
      const cs = Array.isArray(q.c) ? q.c : [q.c];
      if (!Array.isArray(q.o) || q.o.length !== (q.multi ? 5 : 4)) { errors.push('run ' + run + ': id ' + q.id + ' has invalid option count after shuffle'); break; }
      if (cs.some(i => i < 0 || i >= q.o.length)) { errors.push('run ' + run + ': id ' + q.id + ' has invalid correct index after shuffle'); break; }
      if (q.multi && (!Array.isArray(q.c) || q.c.length !== 2)) { errors.push('run ' + run + ': id ' + q.id + ' invalid multi answer after shuffle'); break; }
    }
  }
}

if (typeof ctx.answerStatus !== 'function' || typeof ctx.shuffleQuestionOptions !== 'function') {
  errors.push('answerStatus or shuffleQuestionOptions is not exposed');
} else {
  const statusCases = [
    [{ multi: false, c: 2 }, 2, 'correct'],
    [{ multi: false, c: 2 }, 1, 'incorrect'],
    [{ multi: false, c: 2 }, undefined, 'unanswered'],
    [{ multi: true, c: [0, 4] }, [4, 0], 'correct'],
    [{ multi: true, c: [0, 4] }, [0], 'incorrect'],
    [{ multi: true, c: [0, 4] }, [0, 4, 1], 'incorrect'],
    [{ multi: true, c: [0, 4] }, [], 'unanswered']
  ];
  statusCases.forEach(([q, ans, expected]) => {
    const actual = ctx.answerStatus(q, ans);
    if (actual !== expected) errors.push('answerStatus case failed: expected ' + expected + ', got ' + actual);
  });
  const passAt36 = Math.round((36 / 60) * 100) >= 60;
  const failAt35 = Math.round((35 / 60) * 100) >= 60;
  if (!passAt36) errors.push('36/60 must pass at the 60% threshold');
  if (failAt35) errors.push('35/60 must fail at the 60% threshold');
  for (let i = 0; i < 20; i++) {
    const single = ctx.shuffleQuestionOptions({ multi: false, o: ['a', 'b', 'c', 'd'], c: 2 });
    if (ctx.answerStatus(single, single.c) !== 'correct') { errors.push('single-option shuffle lost the correct answer'); break; }
    const multi = ctx.shuffleQuestionOptions({ multi: true, o: ['a', 'b', 'c', 'd', 'e'], c: [0, 4] });
    if (ctx.answerStatus(multi, multi.c) !== 'correct') { errors.push('multi-option shuffle lost the correct answers'); break; }
  }
}

if (errors.length) {
  console.log('VERIFY FAILED (' + errors.length + '):');
  errors.forEach(e => console.log('  - ' + e));
  process.exit(1);
}
const pct = Math.round(correctLongest / bank.length * 100);
const kCounts = { K1: 0, K2: 0, K3: 0 };
bank.forEach(q => { if (q.k) kCounts[q.k]++; });
console.log('VERIFY PASSED - ' + bank.length + ' questions, correct-longest ' + correctLongest + ' (' + pct + '%), severe 1.5x: ' + severeItems.length);
console.log('Pool: current eligible ' + current.length + ' (multi ' + currentMulti.length + '), new expert ' + fresh.length + ' (multi ' + freshMulti.length + ')');
console.log('New K-levels: K1 ' + kCounts.K1 + ', K2 ' + kCounts.K2 + ', K3 ' + kCounts.K3 + '; 1000 exam builds passed');
