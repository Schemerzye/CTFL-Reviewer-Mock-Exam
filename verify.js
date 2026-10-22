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

// ---------------------------------------------------------------------------
// Answer-position balance: the correct answer must not be guessable by picking
// the same option slot. Single-select items are spread over 4 slots, multi
// items over the 10 possible slot pairs.
// ---------------------------------------------------------------------------
const singleSlots = [0, 0, 0, 0];
const pairSlots = new Map();
bank.forEach(q => {
  if (q.multi) {
    const key = q.c.slice().sort((a, b) => a - b).join(',');
    pairSlots.set(key, (pairSlots.get(key) || 0) + 1);
  } else {
    singleSlots[q.c]++;
  }
});
const singlesTotal = singleSlots.reduce((a, b) => a + b, 0);
singleSlots.forEach((count, slot) => {
  const share = count / singlesTotal;
  if (share > 0.3) errors.push('correct answer in slot ' + slot + ' for ' + (share * 100).toFixed(1) + '% of single-select items (max 30%)');
});
pairSlots.forEach((count, key) => {
  if (count > 6) errors.push('correct answer slot pair [' + key + '] used by ' + count + ' multi-select items (max 6)');
});

// ---------------------------------------------------------------------------
// Regression guards for items corrected by a content audit. Each guard states
// the syllabus fact the item depends on, so a later edit cannot silently
// reintroduce the original error.
// ---------------------------------------------------------------------------
const bankById = new Map(bank.map(q => [q.id, q]));
const keyedText = id => {
  const q = bankById.get(id);
  if (!q) return [];
  return (Array.isArray(q.c) ? q.c : [q.c]).map(i => q.o[i]);
};
const hasKeyMatching = (id, re) => keyedText(id).some(t => re.test(t));

const contentGuards = [
  [11, /test activities/i, 'match', 'id 11: test process must be keyed to the test activities, not to test levels'],
  [12, /can cause/i, 'match', 'id 12: defect must be keyed to the glossary wording "can cause ... to fail"'],
  [34, /defect/i, 'match', 'id 34: the cause of a failure must be keyed to "defect"'],
  [76, /absence-of-defects fallacy/i, 'match', 'id 76: must be keyed to the v4.0.1 principle name "absence-of-defects fallacy"'],
  [282, /equivalence partitioning/i, 'match', 'id 282: the black-box technique must be keyed to equivalence partitioning'],
  [321, /uninstall/i, 'match', 'id 321: installation testing must be keyed to the option that includes uninstallation'],
  [330, /testware/i, 'match', 'id 330: test model must be keyed to the glossary wording "testware"'],
  [508, /budget/i, 'nomatch', 'id 508: "the project budget runs out" must never be keyed as an exit criterion'],
  [508, /coverage/i, 'match', 'id 508: a coverage target must be keyed as an exit criterion'],
  [508, /fixed and closed/i, 'match', 'id 508: closed critical defects must be keyed as an exit criterion'],
  [611, /^3$/, 'match', 'id 611: the drop-down scenario has exactly 3 partitions'],
  [616, /Remove, Remove, Remove/, 'match', 'id 616: the key must cover all six valid transitions'],
  [628, /^TC4$/, 'match', 'id 628: TC4 must be the last test executed'],
  [708, /absence-of-defects fallacy/i, 'match', 'id 708: must use the v4.0.1 principle name "absence-of-defects fallacy"'],
  [844, /without executing/i, 'match', 'id 844: the static analysis tool must be keyed'],
  // second-audit fixes
  [18, /test monitoring and control/i, 'match', 'id 18: the v4.0.1 activity list must be keyed, including test monitoring and control'],
  [21, /consolidate/i, 'match', 'id 21: test completion must be keyed to consolidating experience/testware, not to exit criteria'],
  [33, /prove that defects are absent/i, 'match', 'id 33: the only non-principle statement must be keyed'],
  [35, /component integration/i, 'match', 'id 35: the v4.0.1 test level name must be keyed'],
  [51, /archiving the testware/i, 'match', 'id 51: test closure must match the glossary wording'],
  [61, /sequence of actions/i, 'match', 'id 61: test scenario must use the glossary definition'],
  [77, /individual element/i, 'match', 'id 77: test item must use the glossary definition'],
  [88, /mission statement/i, 'match', 'id 88: test charter must use the glossary definition'],
  [92, /iterative/i, 'match', 'id 92: the iterative/incremental approach must be keyed'],
  [139, /integrated into each/i, 'match', 'id 139: testing integrated into each stage must be keyed'],
  [142, /concurrently/i, 'match', 'id 142: parallel testing must be keyed to concurrent execution'],
  [153, /developer's test environment/i, 'match', 'id 153: alpha/beta must be keyed on the site, per the glossary'],
  [191, /without executing/i, 'match', 'id 191: static analysis must be keyed to analysis without execution'],
  [197, /on their own/i, 'match', 'id 197: individual review must be keyed to reviewers examining alone'],
  [341, /control flow graph/i, 'match', 'id 341: path testing must be keyed to the control flow graph'],
  [342, /true and false/i, 'match', 'id 342: condition coverage requires both true and false'],
  [609, /^11, 12, 1111, 1234$/, 'match', 'id 609: the four-combination set must be keyed'],
  [637, /^1A, 2B, 3C, 4D$/, 'match', 'id 637: the coverage-item mapping must be keyed'],
  [706, /^Tests wear out$/, 'match', 'id 706: the v4.0.1 principle 5 name must be keyed'],
  [774, /Deciding who will be involved/i, 'match', 'id 774: review leader duties must be one of the two keyed options'],
  [800, /percentage/i, 'stemmatch', 'id 800: must ask for a percentage of planned test cases, not "coverage"'],
  [826, /^A test environment$/, 'match', 'id 826: the term itself must be keyed, not a restatement of the stem'],
  // certainty pass: items whose old form had a second defensible option or
  // asked about a term absent from the v4.0.1 syllabus
  [9, /test monitoring and control/i, 'match', 'id 9: test management role must be keyed to its v4.0.1 activities'],
  [19, /^Portability$/, 'match', 'id 19: portability must be keyed as the ISO 25010 characteristic'],
  [55, /Measuring the test process/i, 'match', 'id 55: test process improvement must be keyed to measurement'],
  [59, /29119-3/, 'match', 'id 59: ISO/IEC/IEEE 29119-3 must be the keyed documentation standard'],
  [64, /process oriented/i, 'match', 'id 64: QA process-oriented vs testing product-oriented must be keyed'],
  [81, /invalid date is the error/i, 'match', 'id 81: the error/defect/failure mapping must be keyed'],
  [86, /scope, approach, resources and schedule/i, 'match', 'id 86: test planning purpose must be keyed'],
  [219, /anomalies found per page/i, 'match', 'id 219: the syllabus review metric must be keyed'],
  [228, /review report listing the anomalies/i, 'match', 'id 228: the review output must be keyed'],
  [286, /^State transition testing$/, 'match', 'id 286: state transition testing must be keyed as the syllabus black-box technique'],
  [297, /behaves correctly for valid input/i, 'match', 'id 297: positive testing must be keyed'],
  [299, /difficulty of deriving the expected results/i, 'match', 'id 299: the oracle problem must be keyed'],
  [307, /requirements, design documents and architecture/i, 'match', 'id 307: the test basis must be keyed'],
  [312, /underlying cause of a defect/i, 'match', 'id 312: root cause analysis purpose must be keyed'],
  [313, /coverage items that must be reached/i, 'match', 'id 313: coverage criteria purpose must be keyed'],
  [322, /Deliberately adding defects/i, 'match', 'id 322: fault injection must be keyed'],
  [343, /^Each executable statement/, 'match', 'id 343: statement testing coverage item must be keyed'],
  [345, /white-box technique that analyses how variables/i, 'match', 'id 345: data flow testing must be keyed'],
  [349, /^Each outcome of each decision/, 'match', 'id 349: decision testing coverage item must be keyed'],
  [350, /existing version of the system or an expert/i, 'match', 'id 350: expected-results sources must be keyed'],
  [352, /^Testing is context dependent$/, 'match', 'id 352: the context-dependence principle must be keyed'],
  [356, /ambiguous and can be read in two/i, 'match', 'id 356: an ambiguous requirement must be keyed'],
  [357, /minimum and maximum values of each partition/i, 'match', 'id 357: BVA boundary values must be keyed'],
  [358, /^A transition between two states/i, 'match', 'id 358: a transition must be keyed as the coverage item'],
  [360, /one value per partition suffices/i, 'match', 'id 360: EP reduction must be keyed'],
  [414, /replace the need for test design/i, 'match', 'id 414: tool-automation over-expectation must be keyed as the risk'],
  [719, /^Non-functional testing$/, 'match', 'id 719: non-functional testing must be keyed as the syllabus test type'],
  [787, /^Two$/, 'match', 'id 787: two tests are the minimum for 100 percent decision testing'],
  [841, /fits the existing processes/i, 'match', 'id 841: tool evaluation must be keyed'],
  [856, /incrementally/i, 'match', 'id 856: incremental tool introduction must be keyed'],
  // removed terms must not creep back into the bank as question stems
  ...['IEEE 829', 'fault masking', 'feasibility study', 'cycle time', 'trip report',
      'happy path', "a 'feature list'", 'causal chain', 'test adequacy', 'mutation testing',
      'loop testing', 'basis path', 'MC/DC', 'context-driven', 'requirement validation',
      'boundary analysis', 'state-based testing', 'workflow testing', 'tool pilot']
      .map(term => [0, new RegExp(term, 'i'), 'absent', 'non-syllabus term "' + term + '" must not appear as a question stem']),
  // explanations must not be letter-dependent and must not contradict a re-key
  [190, /plans, facilitates, and tracks/i, 'exnomatch', 'id 190: the facilitator does not plan or track the review'],
  [195, /^Walkthroughs are informal/i, 'exnomatch', 'id 195: walkthroughs are a distinct review type, not "informal"'],
  [291, /branch coverage\)/i, 'stemnomatch', 'id 291: the stem must not equate decision coverage with branch coverage'],
  [605, /set [a-e]\b/i, 'exnomatch', 'id 605: the explanation must not refer to a stale option letter'],
  [606, /set [a-e]\b/i, 'exnomatch', 'id 606: the explanation must not refer to a stale option letter'],
  [609, /^1, 123, 1111, 1234$/, 'nomatch', 'id 609: "1, 123, 1111, 1234" also covers all four combinations and must not be present']
];
contentGuards.forEach(([id, re, mode, msg]) => {
  // The 'absent' mode is bank-wide, so it needs no particular item.
  if (mode === 'absent') {
    if (bank.some(q => re.test(q.q || ''))) errors.push(msg);
    return;
  }
  const q = bankById.get(id);
  if (!q) { errors.push(msg + ' (item missing)'); return; }
  if (mode === 'exnomatch') {
    if (re.test(q.ex || '')) errors.push(msg);
    return;
  }
  if (mode === 'stemnomatch') {
    if (re.test(q.q || '')) errors.push(msg);
    return;
  }
  if (mode === 'stemmatch') {
    if (!re.test(q.q || '')) errors.push(msg);
    return;
  }
  const matched = hasKeyMatching(id, re);
  if (mode === 'match' && !matched) errors.push(msg);
  if (mode === 'nomatch' && matched) errors.push(msg);
});

// Explanations must not depend on option letters (a permuted option list then
// leaves the learner with a dangling reference).
bank.forEach(q => {
  if (/\b(set [a-e]|option [a-e]|answer [a-e]|choice [a-e])\b/i.test(q.ex || '')) {
    errors.push('id ' + q.id + ': explanation refers to an option letter');
  }
});

// No question may reproduce published official sample-exam wording.
bank.forEach(q => {
  if (/derive test cases from test conditions|identify reusable testware|organize test cases into test procedures|evaluate the test basis and test object/i.test(q.q || '')) {
    errors.push('id ' + q.id + ': stem reproduces official sample-exam wording');
  }
});

// Stale v3.1 terminology must not reappear.
bank.forEach(q => {
  if (/absence-of-errors/i.test(q.q + ' ' + q.o.join(' ') + ' ' + q.ex)) errors.push('id ' + q.id + ': uses the stale v3.1 term "absence-of-errors fallacy"');
});

// Expert items must reference a real syllabus section shape.
bank.forEach(q => {
  if (q.diff === 'expert' && !/^Syllabus \d\.\d/.test(q.ref || '')) errors.push('id ' + q.id + ': bad syllabus reference "' + q.ref + '"');
});


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
