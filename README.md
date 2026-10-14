# Oracle Exam Practice

Source repository for the Oracle Exam Practice plugin (version 1.1.0) and its Windows and Mac installers. The plugin creates 50 original practice questions using fresh official Oracle research in the host conversation, provides an interactive exam, and grades answers with explanations and study references.

## Repository layout

- `plugins/oracle-exam-practice/`: application source, exam UI, skills, tests, dependency lockfile, portable manifests, Dockerfile, and installation documentation.
- `installers/windows/`: Windows launcher, setup script, builder, installer tests, and Node redistribution license.
- `installers/mac/`: Mac launcher, setup module, builder, installer tests, and employee instructions.
- `.agents/plugins/marketplace.json`: local repository plugin catalog.
- `.vscode/tasks.json`: development tasks available through Terminal > Run Task.
- `build/`, `dist/`, `downloads/`, and `work/`: ignored local directories for generated files.

## Develop in VS Code

Install Node.js 24 or newer and Git, then open this repository folder in VS Code. From a terminal at the repository root:

```sh
cd plugins/oracle-exam-practice
npm ci
npm test
npm start
```

The HTTP service defaults to `http://127.0.0.1:8787`; `/health` is the health endpoint and `/mcp` is the MCP endpoint. The browser preview cannot generate an exam on its own. `npm run start:stdio` starts the local plugin transport.

VS Code tasks provide dependency installation, application tests, and HTTP startup. Server debugging is available through Run and Debug > Debug Oracle exam server. The plugin requires a compatible ChatGPT/Codex host with web research and MCP Apps UI for a full exam.

## Test the local plugin

The repository catalog points to `./plugins/oracle-exam-practice`. After installing its dependencies, use the supported local marketplace flow in your desktop host. If Codex CLI is installed, run `codex plugin marketplace add .` from this folder, then install and test in the desktop app. Host support and workspace policies determine availability. Restart the host after source changes when required.

Both MCP configuration files use `node` from PATH and `${PLUGIN_ROOT}`. Installers create the runtime paths for each target machine; do not copy installed cache configuration back into this repository.

## Build installers

See [Windows build instructions](installers/windows/README.md) and [Mac build instructions](installers/mac/README.md). Run application tests before packaging. Keep downloaded runtimes in `downloads/`, temporary build files in `build/`, and finished distributions in `dist/`.

## Publish to GitHub

In VS Code, review Source Control, initialize a repository if needed, commit the source files, and choose Publish to GitHub. Start with a private repository. The `.gitignore` excludes dependencies, bundled runtimes, installers, downloaded archives, credentials, databases, and test profiles. Review staged files before publishing.

Tag releases (for example `v1.1.0`) and attach generated installers and checksums to the corresponding GitHub Release. Keep installer source in Git; distribute generated installers as release assets.

## Validation and scope

See [repository validation](VALIDATION.md) for checks performed during this migration and the application's [historical validation record](plugins/oracle-exam-practice/VALIDATION.md). Native Mac installation and live host activation require a separate pilot. Generated practice questions require source verification; this is not official Oracle exam content.

No new software license has been assigned. The copied Node redistribution license and dependency licenses retain their existing terms. Decide on an appropriate project license before public distribution.
