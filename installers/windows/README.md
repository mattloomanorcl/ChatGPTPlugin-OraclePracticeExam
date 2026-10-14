# Single-file Windows installer source

`Oracle-Exam-Practice-Setup.exe` is a per-user .NET Framework executable with an embedded ZIP payload and PowerShell setup script. Its payload includes the application, locked node_modules, Node.js 24.15.0 x64, and licenses. No downloads occur during setup. It does not install ChatGPT, publish a cloud plug-in, or bypass host activation and permission prompts.

The build uses the existing, validly signed Node executable from the approved Node installation. `NODE-LICENSE.txt` is the upstream Node v24.15.0 redistribution license, including bundled third-party notices. Dependency licenses remain in node_modules. The final installer is unsigned; production organization signing can be added using its approved signing process.

## Rebuild

Install application dependencies from the lockfile in the source package first. Use a fresh build directory:

```powershell
# Run from the repository root; use a new build directory each time.
New-Item -ItemType Directory -Path ./dist -Force | Out-Null
./installers/windows/Build.ps1 -PluginSource ./plugins/oracle-exam-practice -NodeExecutable 'C:/Program Files/nodejs/node.exe' -BuildDirectory ./build/windows/new-build -OutputExecutable ./dist/Oracle-Exam-Practice-Setup.exe
```

The builder uses the Windows .NET Framework C# compiler. It hashes the payload and embeds its SHA-256 in the launcher. This detects payload corruption but does not establish publisher authenticity; use organization code signing for that.

## Installation and testing

Double-click the executable for interactive setup. It runs as the current user with no privilege elevation. It starts the embedded Windows PowerShell script in a hidden process. It validates archive paths, checks runtime and all sixteen application tests (including fresh-set generation and stdio startup), and then atomically replaces the catalog with a backed-up merged copy. Existing Oracle policy values are preserved. Previous versioned folders are retained; no attempts or prior plug-in source files are deleted. Temporary extraction files created by the launcher are cleaned up.

For unattended installation, `--silent` suppresses dialogs. `--log PATH` chooses an output log file. `--profile-root PATH` is intended for isolated testing; its folder must already exist. Exit codes are 0 for success, 1 for failure, and 2 for interactive cancellation. ChatGPT activation remains an employee action after unattended setup.

```powershell
./installers/windows/Test-Installer.ps1 -Installer ./dist/Oracle-Exam-Practice-Setup.exe -TestRoot ./work/windows/new-test
```

The test exercises the built executable in workspace profiles, including paths with spaces, runtime/dependency extraction, embedded application checks, reinstallation, backups, preservation of unrelated catalog entries and existing Oracle policy, and safe refusal of malformed catalogs. It does not install into the current user's actual ChatGPT profile. Desktop discovery/activation must be verified separately in a live pilot.
