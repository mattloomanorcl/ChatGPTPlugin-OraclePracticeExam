# Validation performed

Validated October 9, 2026.

## Passed

- Syntax checks for server and domain modules with Node 24.15.0.
- Eight automated domain tests: 100/98/0 percentage scores, exact-set multiple-answer grading, rejection of invalid submissions, reference-host and question validation, 50-question locking and answer-key omission, independent attempt access, immutable reports, expiry and rejection of invalid batches without damaging the draft.
- A headless Edge browser test of the actual HTML widget with a simulated MCP Apps host and synthetic question fixtures. It exercised the entry form, generation follow-up message, incoming question result, all 50 navigation buttons, radio/checkbox choices, selection persistence during navigation, a 98% report with a missed question and reference, option explanations, starting a new exam, and mobile layout. No page script errors occurred.
- Visual inspection of the desktop entry screen.
- Dependency installation completed after the company VPN was disabled. A lockfile is included; the package audit reported zero known vulnerabilities at installation time.
- Full `npm test` run: all nine tests passed, including the MCP SDK integration test for initialization, tool metadata, UI resource retrieval, entry-form tool response, health endpoint, and origin rejection.

## Not yet validated

- Real ChatGPT connection, installed-plugin discovery, browser research and generation against actual Oracle certification pages.
- The correctness and currency of generated questions, explanations and citations. Structural validation does not establish factual accuracy. Perform the live pilot described in `INSTALL.md`.
- Deployment, organizational authentication, employee installation and workspace sharing. No hosted endpoint or registered ChatGPT plug-in was created.

The screenshot shows the real entry interface. Browser grading checks used clearly labeled synthetic fixtures, not actual Oracle exam material. No practice-exam accuracy claim is made from those tests.

## Single-file installer — October 12, 2026

A Windows x64 installer bundles the plug-in, locked dependencies, Node.js runtime and licenses. Isolated profile tests verified initial setup, paths with spaces, catalog merging, backups, reinstallation without duplicate entries, preservation of unrelated plug-ins and existing Oracle policy settings, and refusal to overwrite malformed JSON. The application checks include stdio process startup and UI resource discovery in addition to the original nine tests.

The installer is unsigned. It prepares the local source/catalog; live ChatGPT discovery, employee activation and real exam content remain pilot checks. No installation was made in this user's real ChatGPT profile during validation.

## Desktop-host discovery repair — version 1.0.1

The desktop host reproduced version 1.0.0's missing-tools failure. Its parser reported: `Agent Plugins stdio command must be a bare executable name or a contained ./ path`. The installer had written an absolute runtime path. Standalone SDK tests did not cover that host-level restriction.

Version 1.0.1 writes `./runtime/node.exe` in portable `mcp.json`, retains the explicit legacy server declaration in `.codex-plugin/plugin.json` and `.mcp.json`, and packages both formats. The actual installed desktop executable was used with isolated configuration/catalogs to verify server discovery and list `open_exam_practice`, `begin_exam`, `add_question_batch`, `submit_exam`, and the exam UI resource. This validates host discovery, not the accuracy of generated exams or UI rendering in a live employee conversation.

## Fresh repeat-exam sets — version 1.1.0

Sixteen application tests passed, including six new tests for fresh draft identifiers/seeds, rejected excessive overlap without losing accepted questions, exactly 20 overlaps plus 30 different questions, numeric/cosmetic/close-wording comparisons, persistent history after attempt expiry, 90-day history expiry, recovery when a competing draft finalizes, and seeding history from retained older exams without changing their answer keys.

The server enforces a maximum of 20 prompt-fingerprint matches against the last five retained sets for the same exam code. Fingerprints contain no question text or answer keys. The host must research again and independently ensure substantive scenario/reasoning variation. Automated lexical checks do not guarantee semantic novelty or source accuracy.
