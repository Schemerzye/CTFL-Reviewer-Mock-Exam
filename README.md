# ISTQB CTFL Reviewer & Mock Exam

A free, browser-based exam simulator to help you prepare for the **ISTQB Certified Tester Foundation Level (CTFL)** certification, based on the official **ISTQB Syllabus v4.0 / v4.0.1**.

No account, no install, no tracking. Open the page and start practicing.

## Features

- **414-question pool** across all six syllabus chapters (Fundamentals, SDLC, Static Testing, Test Analysis & Design, Managing Test Activities, Tool Support)
- **Easy to hardest mix** — from definitions to application-level (K3) calculation questions, the kind you see on the real exam
- **"Select TWO" questions** — checkbox questions that require both correct answers, exactly like the official exam
- **Randomized exams** — every attempt pulls a different set of 60 questions and shuffles the answer options, so retakes are meaningful
- **Guaranteed mix per exam** — each 60-question session always includes 3 multi-select and 4 hard questions (plus 53 randomized)
- **60-minute countdown timer** with auto-submit, like the real exam
- **Question palette** — jump to any question and see which ones you've answered
- **Instant results** — score, PASS/FAIL (65% threshold, 39/60), correct/incorrect/unanswered breakdown
- **Full review with explanations** — every question shows the correct answer and a rationale, with filters (All / Correct / Incorrect / Unanswered)
- **Score history** — your last 10 attempts saved locally in your browser
- **Mobile-friendly**

## Exam format (matching the real certification)

| Item | Value |
|---|---|
| Questions per exam | 40 real / 60 in this simulator |
| Time limit | 60 minutes (75 if English is not your first language) |
| Passing score | 65% (26/40 real) |
| Question types | Single-select + "Select TWO" |

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
├── vercel.json     # Vercel static deployment config
├── package.json    # Metadata (no runtime dependencies)
└── README.md
```

## Question sources & accuracy

The question bank is:

- **Based on** the official ISTQB CTFL v4.0 sample exams (Sets A–D and the ASTQB/AT*SQA practice exams) and the **ISTQB Foundation Level Syllabus v4.0**
- **Original/rephrased** wording — no exam content is reproduced verbatim
- **Fact-checked**: each answer and rationale was cross-checked against the official sample-exam answer keys and the syllabus

If you find an error, please open an issue — contributions that keep the pool accurate are welcome.

## Disclaimer

- This project is an **independent, unofficial** study aid. It is **not affiliated with, endorsed by, or sponsored by** ISTQB®, ASTQB, or AT*SQA.
- The pool is a practice tool; it is **not** the real exam and does not guarantee a passing score.
- Always read the official **ISTQB Foundation Level Syllabus** and the **ISTQB Glossary** as your primary sources.

## License

MIT — free to use, modify, and share for educational purposes.