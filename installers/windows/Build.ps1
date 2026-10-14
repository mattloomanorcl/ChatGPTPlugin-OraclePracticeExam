param(
    [Parameter(Mandatory=$true)][string]$PluginSource,
    [Parameter(Mandatory=$true)][string]$NodeExecutable,
    [Parameter(Mandatory=$true)][string]$BuildDirectory,
    [Parameter(Mandatory=$true)][string]$OutputExecutable
)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$source=(Resolve-Path -LiteralPath $PluginSource).Path
$node=(Resolve-Path -LiteralPath $NodeExecutable).Path
$build=[IO.Path]::GetFullPath($BuildDirectory)
New-Item -ItemType Directory -Path $build -Force | Out-Null
$payload=Join-Path $build 'payload.zip'
if(Test-Path -LiteralPath $payload){throw 'Use a fresh build directory.'}
if(-not (Test-Path -LiteralPath (Join-Path $source 'node_modules'))){throw 'Install locked dependencies with npm ci before building.'}
$zip=[IO.Compression.ZipFile]::Open($payload,[IO.Compression.ZipArchiveMode]::Create)
try {
    $files=Get-ChildItem -LiteralPath $source -File -Force
    foreach($folder in @('src','public','skills','test','node_modules','.codex-plugin')) {
        $files+=Get-ChildItem -LiteralPath (Join-Path $source $folder) -File -Recurse -Force
    }
    foreach($file in $files) {
        $name=$file.FullName.Substring($source.Length+1).Replace('\','/')
        if($name -eq '.env' -or $name -match '\.sqlite($|-)'){throw 'Do not package secrets or attempt databases.'}
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$file.FullName,$name,[IO.Compression.CompressionLevel]::Optimal)|Out-Null
    }
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$node,'runtime/node.exe',[IO.Compression.CompressionLevel]::Optimal)|Out-Null
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,(Join-Path $PSScriptRoot 'NODE-LICENSE.txt'),'runtime/NODE-LICENSE.txt',[IO.Compression.CompressionLevel]::Optimal)|Out-Null
} finally {$zip.Dispose()}
$hash=(Get-FileHash -LiteralPath $payload -Algorithm SHA256).Hash.ToLowerInvariant()
$launcher=(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'Setup.cs') -Raw).Replace('PAYLOAD_HASH',$hash)
$launcherPath=Join-Path $build 'Setup-generated.cs'
[IO.File]::WriteAllText($launcherPath,$launcher)
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /target:winexe /platform:anycpu /optimize+ "/out:$OutputExecutable" /reference:System.Windows.Forms.dll "/resource:$payload,payload.zip" "/resource:$(Join-Path $PSScriptRoot 'Install.ps1'),Install.ps1" $launcherPath
if($LASTEXITCODE -ne 0){throw 'Installer compilation failed.'}
Get-Item -LiteralPath $OutputExecutable | Select-Object Name,Length
Get-FileHash -LiteralPath $OutputExecutable -Algorithm SHA256
