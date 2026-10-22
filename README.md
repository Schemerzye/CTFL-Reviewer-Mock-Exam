# ISTQB CTFL Reviewer & Mock Exam

A free, browser-based exam simulator to help you prepare for the **ISTQB Certified Tester Foundation Level (CTFL)** certification, based on the official **ISTQB Syllabus v4.0 / v4.0.1**.

No account, no install, no tracking. Open the page and start practicing.

## Features

- **574-question pool**: 414 current questions plus 160 new expert-level scenarios across all six syllabus chapters
- **120-level challenge mode**: every 60-question exam mixes **30 current hard/Select TWO questions** with **30 new expert questions**
- **8 "Select TWO" questions** per exam, like the official sample exams
- **60-minute countdown timer** with auto-submit, like the real exam
- **Official chapter proportions**: 12 Fundamentals, 9 SDLC, 6 Static Testing, 17 Test Analysis & Design, 13 Managing Test Activities, 3 Tool Support
- **Question palette** — jump to any question and see which ones you have answered
- **Instant results** — score, PASS/FAIL (60% threshold, 36/60), correct/incorrect/unanswered breakdown, and per-chapter accuracy
- **Full review with explanations** — every question shows the correct answer and a rationale, with filters (All / Correct / Incorrect / Unanswered)
- **Score history** — your last 10 attempts saved locally in your browser
- **Mobile-friendly**

## Exam format

| Item | Value |
|---|---|
| Questions per exam | 60 |
| Time limit | 60 minutes |
| Passing score | 60% (36/60) |
| Question mix | 30 current hard/Select TWO + 30 new expert |
| Question types | Single-select + "Select TWO" |
| Select TWO count | 8 |

## Difficulty calibration

The exam is designed to be harder than the real CTFL foundation exam: it uses multi-step scenarios, close distractors, calculation items, and very few recall-only questions. "120-level" is a design target for reasoning load, not a literal IQ score. A real IQ mapping would require norming data that this project does not have.

The chapter mix follows the official CTFL proportions scaled to 60 questions. The K-level mix is intentionally K2/K3-heavy, with almost no K1 recall items.

## Getting started

### Run locally

This is a single static HTML file — no build step, no dependencies.

```bash
# Option 1: Node.js
npx serve .

# Option 2: Python
python -m http.server 8000
```

Then open the printed URL (e.g., http://localhost:3000).

You can also just open `index.html` directly in any modern browser.

### Deploy

Works anywhere that hosts static files (Vercel, Netlify, GitHub Pages, etc.).

**Vercel:** import the repo on vercel.com, or:

```bash
npx vercel --prod
```

A `vercel.json` is included so no configuration is needed.

## Project structure

```
CTFL-Reviewer-Mock-Exam/
├── index.html      # Entire app (HTML + CSS + JS + question bank)
├── verify.js       # Structural, pool-composition, and exam-builder checks
├── vercel.json     # Vercel static deployment config
├── package.json    # Metadata (no runtime dependencies)
└── README.md
```

## Validation

Run the automated checks any time the question bank changes:

```bash
node verify.js
```

It verifies:

- 574 total questions and valid option counts (4 single-select, 5 multi-select)
- No duplicate IDs, question stems, or option text
- Correct indices in range; every Select TWO item has exactly two answers
- Expert items have a K-level and a syllabus reference
- No banned option phrases such as "all of the above"
- The correct answer is not guessable by length (global threshold plus a per-item 1.5x check)
- The 120 pool has enough current and new items per chapter
- **1,000 simulated exam builds**: always 60 unique questions, the 30/30 mix, 8 Select TWO, correct chapter quotas, and no easy current items

## Question sources & accuracy

The question bank is:

- **Based on** the official ISTQB CTFL v4.0 sample exams (Sets A–D and the ASTQB/AT*SQA practice exams) and the **ISTQB Foundation Level Syllabus v4.0**
- **Original/rephrased** wording — no exam content is reproduced verbatim
- **Fact-checked**: each answer and rationale was cross-checked against the official sample-exam answer keys and the syllabus
- **Length-balanced**: options are written so the correct answer is not identifiable by length or phrasing (verified by `verify.js`)

If you find an error, please open an issue — contributions that keep the pool accurate are welcome.

## Disclaimer

- This project is an **independent, unofficial** study aid. It is **not affiliated with, endorsed by, or sponsored by** ISTQB®, ASTQB, or AT*SQA.
- The pool is a practice tool; it is **not** the real exam and does not guarantee a passing score.
- Always read the official **ISTQB Foundation Level Syllabus** and the **ISTQB Glossary** as your primary sources.

## License

MIT — free to use, modify, and share for educational purposes.
