param([Parameter(Mandatory=$true)][string]$Installer,[Parameter(Mandatory=$true)][string]$TestRoot)
$ErrorActionPreference='Stop'
$exe=(Resolve-Path -LiteralPath $Installer).Path
$base=[IO.Path]::GetFullPath($TestRoot)
if(Test-Path -LiteralPath $base){throw 'Use a fresh test directory.'}
New-Item -ItemType Directory -Path $base | Out-Null
function Assert($value,[string]$message){if(-not $value){throw $message}}
function Run([string]$profile,[string]$log){
    $arguments='--silent --profile-root "'+$profile+'" --log "'+$log+'"'
    $process=Start-Process -FilePath $exe -ArgumentList $arguments -WindowStyle Hidden -Wait -PassThru
    return $process.ExitCode
}
$fresh=Join-Path $base 'Fresh profile with spaces'
New-Item -ItemType Directory -Path $fresh | Out-Null
$log=Join-Path $base 'fresh.log'
Assert ((Run $fresh $log) -eq 0) ('Fresh installation failed: '+$log)
$catalogPath=Join-Path $fresh '.agents/plugins/marketplace.json'
$catalog=Get-Content -LiteralPath $catalogPath -Raw | ConvertFrom-Json
Assert ($catalog.plugins.Count -eq 1) 'Fresh catalog entry count is incorrect.'
$installed=[IO.Path]::GetFullPath((Join-Path $fresh $catalog.plugins[0].source.path))
Assert (Test-Path -LiteralPath (Join-Path $installed 'runtime/node.exe')) 'Bundled runtime missing.'
Assert (Test-Path -LiteralPath (Join-Path $installed 'node_modules/@modelcontextprotocol/sdk/package.json')) 'Bundled SDK missing.'
$mcp=Get-Content -LiteralPath (Join-Path $installed 'mcp.json') -Raw | ConvertFrom-Json
Assert ($mcp.mcpServers.'oracle-exam-practice'.command -eq './runtime/node.exe') 'Portable runtime command must be a contained relative path.'
$compat=Get-Content -LiteralPath (Join-Path $installed '.codex-plugin/plugin.json') -Raw | ConvertFrom-Json
Assert ($compat.mcpServers -eq './.mcp.json') 'Desktop host server declaration missing.'
$legacy=Get-Content -LiteralPath (Join-Path $installed '.mcp.json') -Raw | ConvertFrom-Json
Assert ($legacy.mcpServers.'oracle-exam-practice'.command -eq (Join-Path $installed 'runtime/node.exe')) 'Desktop compatibility runtime path is wrong.'
Assert ((Get-Content -LiteralPath $log -Raw).Contains('pass 16')) 'Installed application did not pass all sixteen tests.'
Assert ((Run $fresh (Join-Path $base 'reinstall.log')) -eq 0) 'Reinstallation failed.'
$reinstalled=Get-Content -LiteralPath $catalogPath -Raw | ConvertFrom-Json
Assert ($reinstalled.plugins.Count -eq 1) 'Reinstallation duplicated the catalog entry.'
Assert (Test-Path -LiteralPath $installed) 'Reinstallation removed the previous source installation.'
Assert (@(Get-ChildItem -LiteralPath (Split-Path $catalogPath) -Filter '*.bak').Count -eq 1) 'Catalog backup missing.'

$existing=Join-Path $base 'Existing catalog'
New-Item -ItemType Directory -Path (Join-Path $existing '.agents/plugins') -Force | Out-Null
$existingCatalog=Join-Path $existing '.agents/plugins/marketplace.json'
$fixture='{"name":"employee-catalog","customSetting":"keep-me","interface":{"displayName":"My Catalog"},"plugins":[{"name":"another-plugin","source":{"source":"local","path":"./other"},"policy":{"installation":"AVAILABLE","authentication":"ON_INSTALL"},"category":"Productivity"},{"name":"oracle-exam-practice","source":{"source":"local","path":"./old-oracle"},"policy":{"installation":"NOT_AVAILABLE","authentication":"ON_USE"},"customFlag":true}]}'
[IO.File]::WriteAllText($existingCatalog,$fixture)
Assert ((Run $existing (Join-Path $base 'merge.log')) -eq 0) 'Catalog merge failed.'
$merged=Get-Content -LiteralPath $existingCatalog -Raw | ConvertFrom-Json
Assert ($merged.name -eq 'employee-catalog' -and $merged.customSetting -eq 'keep-me') 'Existing marketplace identity/settings changed.'
Assert ($merged.plugins.Count -eq 2 -and $merged.plugins[0].source.path -eq './other') 'Unrelated plug-in entry changed.'
Assert ($merged.plugins[1].policy.installation -eq 'NOT_AVAILABLE' -and $merged.plugins[1].customFlag) 'Existing Oracle policy/settings changed.'

$malformed=Join-Path $base 'Invalid catalog'
New-Item -ItemType Directory -Path (Join-Path $malformed '.agents/plugins') -Force | Out-Null
$badPath=Join-Path $malformed '.agents/plugins/marketplace.json'
[IO.File]::WriteAllText($badPath,'this is not JSON')
Assert ((Run $malformed (Join-Path $base 'invalid.log')) -eq 1) 'Invalid catalog should fail safely.'
Assert ([IO.File]::ReadAllText($badPath) -ceq 'this is not JSON') 'Invalid catalog was overwritten.'
Write-Output 'PASS: fresh profile, paths with spaces, bundled runtime/dependencies, sixteen installed app checks including fresh-set generation and stdio startup, reinstall, catalog backup, unrelated entries and policy preservation, malformed-catalog refusal.'
