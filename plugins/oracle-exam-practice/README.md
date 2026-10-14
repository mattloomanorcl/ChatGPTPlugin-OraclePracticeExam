# Oracle Exam Practice

A distributable ChatGPT MCP plug-in that turns an Oracle exam name and code into **50 original practice questions**, lets employees select answers in an interactive panel, and returns a percentage score with explanations and official Oracle study references for every missed question.

## What is implemented

- Exam name and code entry in ChatGPT, with research conducted by the ChatGPT host.
- An instruction-driven research workflow that checks the exam identity, objectives and version against official Oracle pages before drafting questions.
- Ten-question batches, exactly 50 questions per attempt, coverage of every researched objective, and validation of choices, answer keys and Oracle reference hosts.
- Single-answer and multiple-answer questions; previous/next navigation, question jump grid and completion progress.
- Server grading: 2 points per correct question, exact-set matching for multiple answers, no partial credit. Unanswered questions score zero.
- Missed-question review with selected answers, correct answers, an explanation of every option and linked references. Results can be downloaded as JSON.
- Separate random tokens for question authoring and answer submission; answer keys are omitted from the unsubmitted question payload. Submission is app-only, and the attempt token is sent in UI metadata.
- Every exam request, including a repeated exam, requires fresh source research and a new 50-question set. At most 20 questions may match fingerprints from the previous five sets for that code; at least 30 must differ. The host also checks that scenarios/reasoning are substantively different.
- SQLite persistence, immutable submitted reports, expiry after 48 hours, and independent attempts for different employees.
- Portable plug-in manifest, stdio and HTTP transports, Docker deployment, installation and rollout instructions.

## Current delivery status

This is a source package, not an already published ChatGPT plug-in or an employee-accessible hosted service. Dependency installation, a compatible host, and connection registration are required. See `INSTALL.md` for individual installation and the later workspace option. Consult `VALIDATION.md` for checks actually completed on this machine.

Question generation runs in the employee's ChatGPT conversation, rather than a separately billed API backend. **No OpenAI API key is required.** The host must support web research and MCP Apps UI. A tool-only host can invoke the research tools, but cannot provide the required answer-selection experience.

The server validates structure, count, objective coverage and allowed reference URLs. It does **not** independently prove that an exam name matches its code, that citations support answers, or that questions are accurate. Those checks are part of the ChatGPT research workflow. If browsing is unavailable or official objectives cannot be verified, the workflow must stop rather than guess. AI-generated content needs subject-matter review before a broad employee rollout. This is practice material, not official Oracle exam content or an employee performance test.

Repeat-exam overlap checks use hashed prompt-word fingerprints, including normalization of punctuation and numeric/literal substitutions and a close-wording comparison. This detects exact and many superficial rewrites, not every semantic paraphrase. It does not prove conceptual novelty. Research and substantive question variation remain part of the host workflow. Only fingerprints are retained for 90 days, capped at five finalized sets per exam code; historical question text and answer keys are not retained in this index. Unexpired sets from earlier versions seed the index on upgrade. Attempts and scores still expire after 48 hours. History covers this installation/database, not other employees' separate computers.

## Development

Requires Node.js 24 or newer.

```sh
npm install
npm test
npm start
```

HTTP binds to `127.0.0.1:8787` by default. `/mcp` is the MCP endpoint, `/health` is a health check, and `/` shows the entry interface as a preview. The preview does not generate questions outside ChatGPT. For stdio, run `npm run start:stdio`.

`EXAM_DB` selects the SQLite file. By default it is in the user's `.oracle-exam-practice` directory. `PORT` selects the port and `HOST` selects the bind address. Keep data files on a persistent volume for hosted deployment. Do not distribute live databases or attempt tokens.

The server is deliberately anonymous and collects no employee identity. There is no identity provider, SSO or administrator reporting feature in this package. For hosting, protect the endpoint with a workspace-scoped Secure MCP Tunnel or a compatible authenticated gateway before making it available. The 48-hour expiry and capability tokens provide attempt isolation; they are not a replacement for organizational access controls. Results are study data and should stay private to the employee.

## Official integration references

- [MCP server and UI quickstart](https://developers.openai.com/plugins/build/app-quickstart)
- [MCP Apps UI integration](https://developers.openai.com/plugins/build/chatgpt-ui)
- [Plug-in packaging](https://developers.openai.com/plugins/build/plugins)
- [Connect and test](https://developers.openai.com/plugins/deploy/connect-chatgpt)
- [Authentication](https://developers.openai.com/plugins/build/auth)

Independent study aid; not affiliated with Oracle or OpenAI.
