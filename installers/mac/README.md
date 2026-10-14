# Mac installer source

The build creates `Oracle-Exam-Practice-Setup.command`, a self-extracting Bash script with an embedded gzip-compressed tar payload, and a ZIP containing that installer plus employee instructions. The ZIP gives the `.command` file Unix mode 0755 so macOS extraction preserves its executable permission.

The payload includes the same version 1.1.0 plug-in used by the Windows installer, its locked dependencies, and Node.js 24.15.0 binaries for macOS arm64 and x64. The builder verifies the official archive checksums and Mach-O CPU headers before packaging. It includes the upstream Node redistribution license. Only the selected runtime is copied into the installation.

The launcher checks macOS 13.5+, detects Apple Silicon (including a shell running under Rosetta), checks the embedded payload checksum, and invokes the bundled Node runtime. No Python, package manager, sudo, or network request is used during employee setup. The Node installer performs validation and merges the personal catalog, preserving existing policies and unrelated entries, saving a catalog backup, and refusing concurrent edits or malformed JSON. Previous installations and exam data are retained.

## Rebuild

Requires Python 3.11+ on the build machine. Install application dependencies from its lockfile first. Obtain these official release files from `https://nodejs.org/dist/v24.15.0/` in a download directory:

- `SHASUMS256.txt`
- `node-v24.15.0-darwin-arm64.tar.gz`
- `node-v24.15.0-darwin-x64.tar.gz`

From the repository root, prepare the output folder and copy the included employee instructions, then run:

```sh
mkdir -p dist
cp installers/mac/README-Mac.md dist/README-Mac.md
python installers/mac/build.py --source plugins/oracle-exam-practice --downloads downloads --output dist
```

The checksum protects against corruption, not replacement of the whole unsigned installer. Neither the launcher nor the distribution ZIP is Developer ID signed or notarized. An approved Mac signing/notarization process is a separate deployment step.

## Validation limits

Nine filesystem/catalog installer tests passed in isolated Windows profiles, including exact-path setup reports and URI encoding of the local plug-in link. The copied application passed all sixteen checks using the Windows runtime. Shell syntax passed a Bash syntax check. Official runtime archive checksums, binary architecture headers, payload layout, ZIP executable permissions and embedded payload checksums were inspected.

The Mach-O runtimes, native macOS shell launch, macOS quarantine/Gatekeeper behavior and live Mac host activation could not be executed on this Windows machine. Pilot on a Mac before wider distribution. On the target Mac the installer runs all sixteen application tests using the selected Mac runtime before registering the catalog entry.

`test.mjs` deliberately substitutes a fixture/runtime validator for most unit cases, then checks the actual copied application with the available native test runtime. It does not pretend to execute a Mac binary on Windows. Supply a fresh `MAC_INSTALLER_TEST_ROOT` directory when repeating those tests.

## Mac installer revision 2

Uses the OS account's home rather than relying on a possibly altered HOME variable and refuses root/sudo installation. Logs the exact installed source and catalog paths, reads back the written entry, and reports that host activation remains required. The shell records a transcript beside the installer (or prints a temporary fallback path). The Node phase creates a human-readable setup report and `Open-Oracle-Exam-Practice.webloc` beside the installer, with a fallback to the per-user log folder when needed. The helper uses the documented local plug-in link with the absolute catalog path. Interactive setup tries to open that detail page without claiming it is installed or visible in Personal.

The employee instructions use the tester's actual Plug-Ins > Personal interface and require Command-Q rather than merely closing a window. Security approval steps are documented, but the installer remains unsigned/unnotarized. These changes address source-level registration/path diagnostics and restart/instruction issues; they do not establish the exact cause of the original tester's missing files or confirm native Mac activation without a new Mac test.

## Mac installer revision 3

The revision 2 screenshots show a silent exit after the confirmation prompt, before any Node-phase messages or files. Reproducing a launch through a directory alias confirmed that the CLI entry-point comparison skipped setup: Node canonicalized the module URL while the argument retained the alias. On macOS this applies to TMPDIR under /var versus /private/var. Both sides now use realpathSync, and the launcher also canonicalizes its staging directory. A regression test launches the actual CLI through a directory alias.

The launcher prints progress messages and requires a completion receipt written by the Node phase after catalog verification and creation of the report/helper. A zero process exit without that receipt is now an explicit failure. A full CLI test verifies the completion receipt and its actual catalog/report/helper files. On Windows, that test uses a copy of the installer with application validation pointed at the available Windows runtime, because Windows cannot execute a binary copied to the Mac name `node` without `.exe`; the distributed installer uses its selected Mac runtime unchanged. These changes do not sign or notarize the package or establish native Mac host discovery.

## Run installer tests from the repository root

Install plugin dependencies first. The default fixture directory is `work/mac-installer/tests`; it must not already exist. On Windows or Mac:

```sh
node --test installers/mac/test.mjs
```

These checks use the current machine's Node runtime. They do not establish native Mac compatibility when run on Windows. `MAC_INSTALLER_TEST_ROOT` and `MAC_PLUGIN_SOURCE` can override the defaults.
