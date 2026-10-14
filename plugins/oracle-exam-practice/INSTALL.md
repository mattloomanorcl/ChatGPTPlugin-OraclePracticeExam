# Install individually now; deploy to a workspace later

## Single-file Windows installer (recommended for employees)

**Repair release 1.0.1:** fixes the “skill is available, but exam tools aren't connected” error. Version 1.0.0 wrote an absolute runtime command that the desktop host rejected. The repaired installer uses the allowed package-relative command and includes compatibility manifests. Run the updated installer, refresh/reinstall Oracle Exam Practice from its existing local catalog, fully restart the desktop app, and begin a new chat. Your existing chat may retain its earlier tool list. If an installer updated the source folder but the installed version is still 1.0.0, reinstall the plug-in from the catalog to refresh its cache; do not manually edit cache files.

Distribute **Oracle-Exam-Practice-Setup.exe**. Employees need only this one file; it includes the plug-in, its locked dependencies, Node.js 24.15.0 and redistribution licenses. No setup downloads, separate Node installation, npm commands, or administrator access are required.

1. Run `Oracle-Exam-Practice-Setup.exe` on 64-bit Windows and select **OK** to install for the current Windows user.
2. Wait for the completion message. Setup tests the bundled plug-in and registers it in the user's personal local catalog. Existing catalog entries and policy settings are preserved; any previous catalog is backed up.
3. Quit and reopen ChatGPT desktop. In **Work/Codex > Plugins Directory**, select **Oracle Practice (Local)**, or the existing personal catalog's display name.
4. Install/enable **Oracle Exam Practice**, start a new conversation and ask **“Open Oracle Exam Practice.”**

The installer prepares the local package and its catalog entry; it does not override ChatGPT's permission or activation controls. ChatGPT desktop with local plug-in and MCP Apps UI support is still required. It does not install ChatGPT or create a hosted web connection. Internet access is still needed when taking an exam, for ChatGPT and Oracle documentation research.

**Platform:** 64-bit Windows with Windows PowerShell 5.1 and .NET Framework 4.x (normally present on Windows 10/11). This executable is unsigned; your organization's software signing/approval rules may apply.

**Install behavior:** setup creates a versioned source folder beneath `%USERPROFILE%\.codex\plugins` and merges its entry into `%USERPROFILE%\.agents\plugins\marketplace.json`. It keeps previous source installations and exam data. Reinstallation updates the source reference without duplicating the entry. An existing policy that disables the plug-in is preserved. Invalid JSON or concurrent catalog edits cause setup to stop rather than replace the catalog. Setup logs are saved in the user's temporary folder, with their path shown in the completion/failure message.

The installer passes a process-scoped execution-policy option to Windows PowerShell for its embedded setup script; it does not change machine/user execution-policy settings. If organization policies prohibit this, IT must package/sign it through the approved process.

For removal, disable/uninstall the plug-in in ChatGPT and remove its Oracle entry from the personal catalog, preserving other entries. Keep source folders and the separate `%USERPROFILE%\.oracle-exam-practice` data folder until you decide whether their contents are needed.

The installer and bundled application were tested in isolated Windows profiles. Live activation in your ChatGPT account and real-exam research quality still require a pilot. Manual source installation and browser connection options remain below.

## Choose your installation route

For the current individual-installation plan, use the **ChatGPT desktop app in Work mode or its Codex surface** with local plug-in support. Follow Route A below. If you use **ChatGPT in a browser**, follow Route B; it needs a reachable server connection first. The ZIP contains source files, not an already registered ChatGPT plug-in. No hosted URL or cloud plug-in link has been created yet.

These instructions were checked against official OpenAI documentation on October 9, 2026. Live installation in your ChatGPT account remains unverified; available controls depend on your account and workspace policies.

## Route A — individual installation in ChatGPT desktop (Windows)

### 1. Put the files in a permanent folder

Download `oracle-exam-practice.zip` and choose **Extract All** in File Explorer. Copy its inner `oracle-exam-practice` folder to:

```text
%USERPROFILE%\.codex\plugins\oracle-exam-practice
```

For your Windows account that is `C:\Users\mlooman\.codex\plugins\oracle-exam-practice`. Other employees use their own profile. The folder should directly contain `plugin.json`, `mcp.json`, `package.json`, `package-lock.json`, `src`, `public`, and `skills`; avoid an extra nested `oracle-exam-practice` folder.

### 2. Complete the one-time setup

Install Node.js 24 or newer through your approved software process. Open PowerShell and run:

```powershell
Set-Location "$env:USERPROFILE\.codex\plugins\oracle-exam-practice"
node --version
npm ci
npm test
```

All sixteen tests should pass. `npm ci` downloads the supporting libraries once per installation, and again only for updates or reinstallation. Each exam still needs internet access for ChatGPT and Oracle-source research. No OpenAI API key is needed. Keep TLS verification enabled; use company-approved network/certificate settings if downloads are blocked.

### 3. Add the plug-in to your personal local catalog

Create the `%USERPROFILE%\.agents\plugins` folder if needed. In it, create a UTF-8 file named **marketplace.json** (not `marketplace.json.txt`). If no catalog exists, use:

```json
{
  "name": "oracle-practice-local",
  "interface": { "displayName": "Oracle Practice (Local)" },
  "plugins": [
    {
      "name": "oracle-exam-practice",
      "source": {
        "source": "local",
        "path": "./.codex/plugins/oracle-exam-practice"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

If `marketplace.json` already exists, preserve it and add only the Oracle entry to its `plugins` array. The relative source path is resolved from your profile folder. It identifies the source package; you should not edit ChatGPT's installed cache. See the official [local packaging and catalog instructions](https://developers.openai.com/plugins/build/plugins#install-a-local-plugin-manually).

### 4. Install from ChatGPT

1. Fully quit and reopen ChatGPT desktop.
2. Open its **Work** or **Codex** surface, then the **Plugins Directory**.
3. Select **Oracle Practice (Local)** from the source/marketplace picker (or the existing catalog's display name).
4. Open **Oracle Exam Practice** and choose **Install** or its install plus button. Review any setup/permission prompts.
5. Start a new conversation, enable/select the plug-in, and ask **“Open Oracle Exam Practice.”**

The local server uses `mcp.json` and starts through the host. You do not also need to run `npm start` for this stdio installation. Your installed host must support both web research and MCP Apps UI. If those surfaces or the local catalog are unavailable, use Route B.

### 5. Take a practice exam

Enter the exact exam name and ID. Allow ChatGPT to research and prepare the questions. Select your answers, then choose **Submit for grading**. Review the percentage, missed-answer explanations and Oracle references. **Download results** saves a private copy. A successful connection test alone does not verify generated question accuracy; check the first real session against its sources.

## Route B — install in ChatGPT on the web

### Prerequisite: a reachable exam service

On the service machine, run `npm start` in the package folder. Its default endpoint is `http://127.0.0.1:8787/mcp`. This is a local address, not the public URL to enter in ChatGPT. Keep the process running while using an HTTP connection.

Provide either an approved HTTPS deployment ending in `/mcp`, or a configured **Secure MCP Tunnel** that can reach the service. See [OpenAI's connection and tunnel guidance](https://developers.openai.com/plugins/deploy/connect-chatgpt#prepare-the-endpoint). A tunnel must be set up and running before choosing it in ChatGPT. This package does not provision a tunnel, HTTPS hosting, or authentication automatically. Follow the deployment section below when preparing shared hosting.

### Register and install the connection

1. Sign in to [ChatGPT Plugins](https://chatgpt.com/plugins) using the account that will take practice exams.
2. Select the **plus** button, then **Add custom MCP server**.
3. Enter **Oracle Exam Practice** as the name and **50-question Oracle practice exams with scoring and study references** as the description.
4. Under **Connection**, enter your actual HTTPS `/mcp` URL, or choose **Tunnel** and select the configured tunnel/enter its `tunnel_id`.
5. Configure authentication to match the deployed service. The package itself has no OAuth/SSO implementation; do not choose OAuth unless your gateway actually supplies it.
6. Review the connection warning, select **I understand and want to continue**, then **Create as a plugin**.
7. Check that the connection discovers `open_exam_practice`, `begin_exam`, `add_question_batch`, and `submit_exam`. The submission tool is restricted to the app UI.
8. Install the resulting plug-in, start a new chat, type **@**, and select **Oracle Exam Practice**. Ask **“Open Oracle Exam Practice.”**

This follows the official [ChatGPT server registration instructions](https://developers.openai.com/plugins/deploy/connect-chatgpt#add-the-mcp-server). The server includes the research workflow in its instructions and tool descriptions, so this connection does not need the local skill installed separately.

### If installation does not work

- **Local plug-in is missing:** check the catalog filename, valid JSON, package location, and source path; fully restart desktop and select the correct catalog. Existing catalog entries should remain intact.
- **Node cannot be found:** reopen the desktop app after Node installation so it picks up the updated PATH. Confirm `node --version` in a new PowerShell window.
- **A module is missing:** confirm `npm ci` completed successfully in the source package and reinstall/reload through the host. Do not manually modify its plug-in cache.
- **The web connection fails:** verify the actual HTTPS endpoint or tunnel is running; `localhost` on your computer is not directly reachable by ChatGPT's cloud connection.
- **Add custom MCP server or local installation is unavailable:** ask your workspace administrator whether custom plug-ins are enabled for your account. Account policies can restrict the feature.
- **Tools respond but no exam panel appears:** the host must render MCP Apps UI. Test the connection in a compatible ChatGPT surface before distributing it to employees.
- **Questions are not generated:** allow web research. An unverifiable or mismatched name/code must be corrected rather than guessed.

Each employee can install their own connection while using the same server. Every exam attempt is independent. Do not share the originating chat or an attempt token. This package has no employee identity database or manager score dashboard.

For a remote portable package, change `mcp.json` to:

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  "mcpServers": {
    "oracle-exam-practice": {
      "type": "streamable-http",
      "url": "https://YOUR-APPROVED-HOST/mcp"
    }
  }
}
```

Replace the placeholder with your real deployed URL. Add authentication metadata appropriate to your gateway; never put credentials in the distributable package. For a ChatGPT registered connection, use the actual connection ID supplied by ChatGPT if you later add `.app.json` mappings. Do not invent an ID.

## Later workspace rollout

1. Choose the approved hosting environment and workspace access method with your workspace administrator. The application can use the same MCP tools and UI without changing the exam logic.
2. Install dependencies and run all tests in that environment. Perform a live pilot against several actual Oracle exam codes; verify name/code matching, objective coverage, product versions, and every answer against its cited source. Test both single-answer and multiple-answer questions.
3. Deploy one Node 24 service with a durable SQLite volume, HTTPS and an authenticated gateway, or an approved workspace Secure MCP Tunnel. The server itself does not implement OAuth/SSO. Do not expose the anonymous endpoint publicly without access controls. Configure suitable organization-wide request limits at the gateway; the built-in IP limit is only a basic safeguard.
4. Register the deployed connection in ChatGPT and have the administrator make it available to the intended employees using the workspace's plug-in policies. The available sharing controls depend on the workspace/account. Public directory submission is a separate optional process.
5. Distribute the install instructions or approved workspace plug-in link. Employees start their own sessions rather than sharing exam-attempt links.
6. Publish the operator's privacy/retention statement and support contact; review generated practice content periodically as exam objectives change.

## Container deployment

```sh
docker build -t oracle-exam-practice .
docker run --rm -p 127.0.0.1:8787:8787 -v oracle-practice-data:/app/data oracle-exam-practice
```

The included `package-lock.json` fixes dependency versions for the container build. A host must terminate HTTPS and enforce access controls in front of the container. SQLite supports a single service instance with concurrent employee requests; for horizontal scaling use a shared production database implementation rather than copying SQLite volumes across instances.

## Acceptance checklist for your pilot

- Request the same exam again: source research runs again and a new draft is generated. No more than 20 questions may match recent retained fingerprints; confirm that the majority also uses substantively different scenarios/reasoning. History is capped at five sets per exam for 90 days and is local to each installation or shared database.

- A valid matching exam name/code produces exactly 50 questions and all objective areas appear.
- A mismatched name/code or an unverifiable exam produces an explanation and no fabricated exam.
- No answers appear in the conversation or quiz panel before submission.
- All correct answers score 100%; one wrong answer scores 98%; unanswered questions score zero.
- Multiple-answer questions require the exact set; repeat submission returns the original report.
- Every missed question shows both selected and correct options, a usable explanation, and current official references.
- Two employees have separate attempts and cannot access one another's reports.
- A fresh session works after installing the package or connecting the hosted service.
