param(
    [Parameter(Mandatory=$true)][string]$Payload,
    [string]$ProfileRoot = $env:USERPROFILE,
    [Parameter(Mandatory=$true)][string]$LogFile
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2
Add-Type -AssemblyName System.IO.Compression.FileSystem
$utf8 = New-Object System.Text.UTF8Encoding($false)
function Log([string]$Text) { [IO.File]::AppendAllText($LogFile, $Text + [Environment]::NewLine, $utf8) }
function Inside([string]$Path) {
    $full = [IO.Path]::GetFullPath($Path)
    if (-not $full.StartsWith($script:root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Installation path escaped the selected profile.' }
    return $full
}
function SafeDirectory([string]$Path) {
    $full = Inside $Path
    $walk = $full
    while ($walk.Length -gt $script:root.Length) {
        if (Test-Path -LiteralPath $walk) {
            $item = Get-Item -LiteralPath $walk -Force
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Installation folders must not be junctions or symbolic links.' }
            if (-not $item.PSIsContainer) { throw 'An installation folder is occupied by a file.' }
        }
        $walk = [IO.Path]::GetDirectoryName($walk)
    }
    New-Item -ItemType Directory -Path $full -Force | Out-Null
    return $full
}
try {
    if (-not [Environment]::Is64BitOperatingSystem) { throw 'This installer requires 64-bit Windows.' }
    $script:root = [IO.Path]::GetFullPath($ProfileRoot).TrimEnd('\')
    if (-not (Test-Path -LiteralPath $root -PathType Container)) { throw 'The selected profile folder does not exist.' }
    $stamp = [DateTime]::UtcNow.ToString('yyyyMMddHHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8)
    $catalogFolder = SafeDirectory (Join-Path $root '.agents\plugins')
    $catalogPath = Inside (Join-Path $catalogFolder 'marketplace.json')
    $original = $null
    if (Test-Path -LiteralPath $catalogPath) {
        if (((Get-Item -LiteralPath $catalogPath -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Catalog file must not be a symbolic link.' }
        $original = [IO.File]::ReadAllText($catalogPath)
        $catalog = $original | ConvertFrom-Json
        if ($null -eq $catalog -or $catalog -is [Array] -or -not ($catalog.PSObject.Properties.Name -contains 'name') -or -not ($catalog.name -is [string])) { throw 'Existing catalog is not a valid marketplace object. It has not been changed.' }
        if (-not ($catalog.PSObject.Properties.Name -contains 'plugins') -or $null -eq $catalog.plugins -or -not ($catalog.plugins -is [Array])) { throw 'Existing catalog needs a plugins array. It has not been changed.' }
    } else {
        $catalog = [pscustomobject]@{name='oracle-practice-local';interface=[pscustomobject]@{displayName='Oracle Practice (Local)'};plugins=@()}
    }
    $oracleEntries = @($catalog.plugins | Where-Object { $_.name -eq 'oracle-exam-practice' })
    if ($oracleEntries.Count -gt 1) { throw 'Existing catalog has duplicate Oracle Exam Practice entries. Resolve them before installing.' }
    $pluginParent = SafeDirectory (Join-Path $root '.codex\plugins')
    $packageVersion = '1.1.0'
    $installPath = SafeDirectory (Join-Path $pluginParent ('oracle-exam-practice-' + $packageVersion + '-' + $stamp))
    Log ('Installing to ' + $installPath)
    # The archive is embedded by the builder. Validate every path before extracting.
    $archive = [IO.Compression.ZipFile]::OpenRead($Payload)
    try {
        foreach ($entry in $archive.Entries) {
            $target = [IO.Path]::GetFullPath((Join-Path $installPath $entry.FullName))
            if (-not $target.StartsWith($installPath + '\', [StringComparison]::OrdinalIgnoreCase) -or $entry.FullName.Contains(':')) { throw 'Unsafe archive entry.' }
        }
    } finally { $archive.Dispose() }
    [IO.Compression.ZipFile]::ExtractToDirectory($Payload, $installPath)
    $nodePath = Join-Path $installPath 'runtime\node.exe'
    $serverPath = Join-Path $installPath 'src\server.js'
    $connection = [ordered]@{
        '$schema'='https://agent-plugins.org/schemas/1.0.0/mcp.schema.json'
        mcpServers=[ordered]@{'oracle-exam-practice'=[ordered]@{type='stdio';command='./runtime/node.exe';args=@('${PLUGIN_ROOT}/src/server.js','--stdio')}}
    }
    [IO.File]::WriteAllText((Join-Path $installPath 'mcp.json'), ($connection | ConvertTo-Json -Depth 20), $utf8)
    $compatibilityConnection = [ordered]@{mcpServers=[ordered]@{'oracle-exam-practice'=[ordered]@{command=$nodePath;args=@('${PLUGIN_ROOT}/src/server.js','--stdio');startup_timeout_sec=60}}}
    [IO.File]::WriteAllText((Join-Path $installPath '.mcp.json'), ($compatibilityConnection | ConvertTo-Json -Depth 20), $utf8)
    if (-not (Test-Path -LiteralPath (Join-Path $installPath '.codex-plugin\plugin.json'))) { throw 'Host compatibility manifest is missing.' }
    Log 'Checking the bundled runtime and plug-in...'
    $version = & $nodePath --version 2>&1
    if ($LASTEXITCODE -ne 0 -or "$version" -notmatch '^v24\.') { throw 'Bundled Node runtime failed its version check.' }
    Log ([string]$version)
    # All tests use in-memory attempt stores; no employee exam data is changed.
    $testOutput = & $nodePath --test (Join-Path $installPath 'test\exams.test.js') (Join-Path $installPath 'test\freshness.test.js') (Join-Path $installPath 'test\mcp.test.js') 2>&1
    $testExit = $LASTEXITCODE
    foreach ($line in $testOutput) { Log ([string]$line) }
    if ($testExit -ne 0) { throw 'Plug-in checks failed. Existing catalog and installations were preserved. See the log.' }
    $relative = './' + $installPath.Substring($root.Length + 1).Replace('\','/')
    if ($oracleEntries.Count -eq 1) {
        $entry = $oracleEntries[0]
        # Preserve the user's existing permissions, metadata and policy choices.
        $entry | Add-Member -MemberType NoteProperty -Name source -Value ([pscustomobject]@{source='local';path=$relative}) -Force
    } else {
        $entry = [pscustomobject]@{name='oracle-exam-practice';source=[pscustomobject]@{source='local';path=$relative};policy=[pscustomobject]@{installation='AVAILABLE';authentication='ON_INSTALL'};category='Productivity'}
        $catalog.plugins = @($catalog.plugins) + @($entry)
    }
    # Refuse to overwrite edits made by another installer while checks ran.
    if ($null -ne $original) {
        if (-not (Test-Path -LiteralPath $catalogPath) -or [IO.File]::ReadAllText($catalogPath) -cne $original) { throw 'Catalog changed during installation. Nothing was overwritten. Run setup again.' }
    } elseif (Test-Path -LiteralPath $catalogPath) { throw 'Another process created a catalog. Run setup again to merge it.' }
    $newText = $catalog | ConvertTo-Json -Depth 100
    $null = $newText | ConvertFrom-Json
    $tempCatalog = Inside (Join-Path $catalogFolder ('marketplace-' + $stamp + '.tmp'))
    [IO.File]::WriteAllText($tempCatalog, $newText, $utf8)
    if ($null -ne $original) {
        $backup = Inside (Join-Path $catalogFolder ('marketplace-before-oracle-' + $stamp + '.json.bak'))
        [IO.File]::Replace($tempCatalog, $catalogPath, $backup)
        Log ('Previous catalog saved as ' + $backup)
    } else { [IO.File]::Move($tempCatalog, $catalogPath) }
    Log 'SETUP COMPLETE'
    Log ('Catalog: ' + $catalogPath)
    $display = $catalog.name
    if (($catalog.PSObject.Properties.Name -contains 'interface') -and $catalog.interface -and ($catalog.interface.PSObject.Properties.Name -contains 'displayName')) { $display = $catalog.interface.displayName }
    Log ('Restart ChatGPT desktop, open Work/Codex > Plugins Directory, choose ' + $display + ', and install/enable Oracle Exam Practice.')
    Log 'Then start a new chat and ask: Open Oracle Exam Practice.'
    exit 0
} catch {
    Log ('SETUP FAILED: ' + $_.Exception.Message)
    exit 1
}
