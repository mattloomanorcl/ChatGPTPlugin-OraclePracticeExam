# Repository migration validation

Validated October 14, 2026 on Windows with the installed Node runtime.

## Completed checks

- Installed the application's locked dependencies using `npm ci` from the existing local package cache.
- All 16 application tests passed, including grading, private attempt isolation, immutable results, expiry, fresh exam history, MCP UI metadata, and stdio startup.
- All 9 Mac installer source tests passed in isolated profiles using the Windows Node runtime. These include installation through an aliased path, catalog merging, protection against malformed or concurrently edited catalogs, a full application check, and completion receipts.
- Built the Windows installer from the reorganized source and ran its isolated installer suite successfully: fresh installation, paths with spaces, bundled dependencies/runtime, 16 installed application tests, reinstallation, catalog backups, unrelated entries and Oracle policy preservation, and safe rejection of malformed catalogs.
- Parsed all 9 source JSON/configuration files and the Mac Python builder successfully.

The migration preserves the plugin's version 1.1.0 and application behavior. The Mac test's default source lookup was adjusted to the new directory layout. Installer documentation was updated for the repository paths. Source MCP configuration remains portable; machine-specific runtime paths are generated during installation.

## Remaining platform checks

Native Mac execution, quarantine/Gatekeeper behavior, live desktop host discovery and activation, and accuracy of newly generated Oracle practice questions were not verified in this migration. The Mac distribution was not rebuilt. Historical checks and known limits remain documented alongside the application and installer source.

Generated installers and isolated test profiles used for validation were kept in staging and are not included in the development repository. Installed development dependencies may be present locally but are excluded from Git.
