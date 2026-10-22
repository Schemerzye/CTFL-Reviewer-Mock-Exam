#!/usr/bin/env node
/* <CTFL-Reviewer-Mock-Exam>
 * smoke.test.js - headless end-to-end test of the exam app.
 * Loads index.html into a minimal DOM stub and drives the full lifecycle:
 * start -> answer (single + select-two) -> navigate -> submit -> scoring ->
 * review + filters -> history -> retake -> landing -> timer auto-submit ->
 * select-two cap -> unanswered submit -> corrupt-history resilience.
 * Exit code 0 = pass, 1 = fail. Usage: node smoke.test.js
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const DIR = __dirname;
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const code = html.match(/<script>([\s\S]*)<\/script>/)[1];

const failures = [];
const ok = (cond, msg) => { if (!cond) failures.push(msg); };

// ---------- DOM stub ----------
function makeEl(tag) {
  const cls = new Set();
  const el = {
    tagName: (tag || 'div').toUpperCase(), textContent: '', className: '',
    value: '', checked: false, name: '', type: '', style: {}, children: [], listeners: {},
    classList: {
      add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c),
      toggle: (c, f) => { const on = f === undefined ? !cls.has(c) : !!f; on ? cls.add(c) : cls.delete(c); return on; }
    },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
    dispatch(t, ev) { (this.listeners[t] || []).forEach(fn => fn(ev || {})); }
  };
  let _html = '';
  Object.defineProperty(el, 'innerHTML', {
    get() { return _html; },
    set(v) { _html = String(v); if (_html === '') el.children.length = 0; }
  });
  return el;
}
const byId = new Map();
const getEl = id => { if (!byId.has(id)) { const e = makeEl('div'); e.id = id; byId.set(id, e); } return byId.get(id); };

const store = new Map();
const localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k)
};

let nowMs = 1700000000000;
const timers = [];
let nextTimerId = 1;

const document = {
  getElementById: getEl,
  createElement: tag => makeEl(tag),
  createTextNode: t => ({ textContent: t }),
  querySelectorAll: () => [],
  body: makeEl('body')
};

const RealDate = Date;
class FakeDate extends RealDate {
  constructor(...args) { super(...(args.length ? args : [nowMs])); }
  static now() { return nowMs; }
}

const ctx = {
  console, Math, JSON, Object, Array, String, Number, Boolean, Set, Map, RegExp, Error, parseInt, parseFloat, isNaN,
  Date: FakeDate,
  document, localStorage,
  alert: m => failures.push('unexpected alert: ' + m),
  confirm: () => true,
  setInterval: (fn, ms) => { const id = nextTimerId++; timers.push({ id, fn, ms }); return id; },
  clearInterval: id => { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); },
  setTimeout: (fn) => { fn(); return 0; },
  clearTimeout: () => {}
};
ctx.globalThis = ctx;
ctx.window = ctx;
vm.createContext(ctx);
new vm.Script(code).runInContext(ctx);

const ev = expr => vm.runInContext(expr, ctx);
const exam = () => ev('examQuestions');
const userAnswers = () => ev('userAnswers');

// ---------- helpers ----------
const answersFor = (qi, pickCorrect) => {
  const q = exam()[qi];
  const opts = getEl('options-container').children;
  ok(opts.length === q.o.length, 'question ' + qi + ' rendered ' + opts.length + ' options, expected ' + q.o.length);
  const idxs = Array.isArray(q.c) ? q.c : [q.c];
  const toCheck = pickCorrect ? idxs : idxs.map(i => (i + 1) % q.o.length);
  toCheck.forEach(i => { const input = opts[i].children[0]; input.checked = true; input.dispatch('change'); });
  // radio inputs auto-uncheck their siblings in a real browser and do NOT fire
  // a change event for that, so no extra dispatch here.
};
const tick = seconds => { nowMs += seconds * 1000; timers.slice().forEach(t => t.fn()); };

// ---------- 1. start ----------
ctx.startExam();
ok(exam().length === 60, 'exam has 60 questions, got ' + exam().length);
ok(getEl('exam').style.display === 'block', 'exam view visible');
ok(getEl('landing').style.display === 'none', 'landing hidden');
ok(getEl('timer').textContent === '60:00', 'timer shows 60:00, got ' + getEl('timer').textContent);
ok(exam().filter(q => q.multi).length === 8, 'exam has 8 select-two questions, got ' + exam().filter(q => q.multi).length);

// ---------- 2. answer everything correctly ----------
for (let i = 0; i < exam().length; i++) {
  ev('currentQuestion = ' + i);
  ev('renderQuestion()');
  answersFor(i, true);
}
ok(Object.keys(userAnswers()).length === 60, 'all 60 answered, got ' + Object.keys(userAnswers()).length);

// ---------- 3. select-two cap ----------
const multiIdx = exam().findIndex(q => q.multi);
ok(multiIdx >= 0, 'exam contains a select-two question');
ev('currentQuestion = ' + multiIdx);
ev('renderQuestion()');
{
  const opts = getEl('options-container').children;
  const q = exam()[multiIdx];
  const third = (q.c[0] + 2) % 5;
  [q.c[0], q.c[1], third].forEach(i => { const inp = opts[i].children[0]; inp.checked = true; inp.dispatch('change'); });
  const sel = userAnswers()[multiIdx];
  ok(Array.isArray(sel) && sel.length === 2, 'select-two refuses a third selection, got ' + JSON.stringify(sel));
  ok(opts[third].children[0].checked === false, 'third checkbox unchecked after refusal');
}

// ---------- 4. navigation ----------
ev('currentQuestion = 0'); ev('renderQuestion()');
ctx.prevQuestion();
ok(ev('currentQuestion') === 0, 'prev at first question does not move');
ctx.nextQuestion();
ok(ev('currentQuestion') === 1, 'next moves forward');
ev('currentQuestion = 59'); ev('renderQuestion()');
ctx.nextQuestion();
ok(ev('currentQuestion') === 59, 'next at last question does not move past end');
ctx.prevQuestion();
ok(ev('currentQuestion') === 58, 'prev moves back');

// ---------- 5. perfect submit ----------
ctx.submitExam(true);
ok(getEl('results').style.display === 'block', 'results visible');
ok(getEl('score-display').textContent === '60/60 (100%)', 'perfect score, got ' + getEl('score-display').textContent);
ok(getEl('pass-display').textContent === 'PASS', 'PASS shown, got ' + getEl('pass-display').textContent);
ok(getEl('stat-correct').textContent === 60, '60 correct');
ok(getEl('stat-incorrect').textContent === 0, '0 incorrect');
ok(getEl('stat-unanswered').textContent === 0, '0 unanswered');
const reviewItems = getEl('review-list').children;
ok(reviewItems.length === 60, 'review lists 60 items, got ' + reviewItems.length);
const correctMarks = reviewItems.reduce((n, d) => n + ((d.innerHTML.match(/\(Correct\)/g) || []).length), 0);
const expectedMarks = exam().reduce((n, q) => n + (Array.isArray(q.c) ? q.c.length : 1), 0);
ok(correctMarks === expectedMarks, 'review marks every correct option (' + expectedMarks + ' expected, got ' + correctMarks + ')');
ok(getEl('chapter-breakdown').innerHTML.includes('Chapter'), 'chapter breakdown rendered');
ok(store.get('istqb_history'), 'history persisted');
ok(JSON.parse(store.get('istqb_history')).length === 1, 'history has 1 entry');

// ---------- 6. filters ----------
const fakeBtn = { classList: { add: () => {}, remove: () => {}, toggle: () => {} } };
ctx.filterReview('incorrect', fakeBtn);
ok(getEl('review-list').children.length === 0, 'incorrect filter shows no items on a perfect run');
ctx.filterReview('all', fakeBtn);
ok(getEl('review-list').children.length === 60, 'all filter shows 60 items, got ' + getEl('review-list').children.length);

// ---------- 7. retake + one wrong answer ----------
ctx.retakeExam();
ok(exam().length === 60, 'retake builds a new 60-question exam');
ok(Object.keys(userAnswers()).length === 0, 'retake clears answers');
ev('currentQuestion = 0'); ev('renderQuestion()');
answersFor(0, false);
ctx.submitExam(true);
ok(getEl('pass-display').textContent.startsWith('FAIL'), 'wrong answer fails, got ' + getEl('pass-display').textContent);
ok(getEl('stat-incorrect').textContent === 1, 'one incorrect recorded');
ok(getEl('stat-unanswered').textContent === 59, '59 unanswered recorded');

// ---------- 8. all unanswered ----------
ctx.retakeExam();
ctx.submitExam(true);
ok(getEl('stat-unanswered').textContent === 60, '60 unanswered recorded');
ok(getEl('score-display').textContent === '0/60 (0%)', 'zero score, got ' + getEl('score-display').textContent);

// ---------- 9. timer auto-submit ----------
ctx.retakeExam();
ok(timers.length > 0, 'timer interval registered');
nowMs += 3601 * 1000;
tick(1);
ok(getEl('results').style.display === 'block', 'timer expiry auto-submits');
ok(getEl('stat-unanswered').textContent === 60, 'auto-submit records all as unanswered');

// ---------- 10. landing ----------
ctx.showLanding();
ok(getEl('landing').style.display === 'block', 'landing visible again');
ok(getEl('results').style.display === 'none', 'results hidden after going home');

// ---------- 11. history rendering + resilience ----------
ctx.renderHistory();
ok(getEl('history-content').innerHTML.includes('history-table'), 'history table rendered');
store.set('istqb_history', '{not json');
ctx.renderHistory();
ok(getEl('history-content').innerHTML.includes('No exam history yet'), 'corrupt history handled');
store.set('istqb_history', JSON.stringify([{ score: 50, correct: 30 }]));
ctx.renderHistory();
ok(!getEl('history-content').innerHTML.includes('NaN'), 'missing timeUsed does not render NaN');
store.set('istqb_history', JSON.stringify('not-an-array'));
ctx.renderHistory();
ok(getEl('history-content').innerHTML.includes('No exam history yet'), 'non-array history handled');

// ---------- 12. answer-position randomness across exams ----------
const keyPositions = new Set();
for (let i = 0; i < 40; i++) {
  const ex = ev('buildExam()');
  ex.forEach(q => keyPositions.add(Array.isArray(q.c) ? q.c.join(',') : q.c));
}
ok(keyPositions.size >= 4, 'option order is reshuffled per exam (positions seen: ' + keyPositions.size + ')');

// ---------- report ----------
if (failures.length) {
  console.log('SMOKE TEST FAILED (' + failures.length + '):');
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
console.log('SMOKE TEST PASSED - lifecycle, scoring, edge cases and resilience all hold');
