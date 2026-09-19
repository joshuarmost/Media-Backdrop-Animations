param(
    [Parameter(Mandatory = $true)]
    [string]$OutputZip,

    [Parameter(Mandatory = $true)]
    [string[]]$InputFiles
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression

$fixedTimestamp = [DateTimeOffset]::Parse('2026-09-19T00:00:00Z')
$outputDirectory = Split-Path -Parent $OutputZip

if ($outputDirectory) {
    New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
}

if (Test-Path $OutputZip) {
    Remove-Item $OutputZip -Force
}

$archiveStream = [System.IO.File]::Open($OutputZip, [System.IO.FileMode]::CreateNew)
try {
    $archive = [System.IO.Compression.ZipArchive]::new($archiveStream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
    try {
        foreach ($inputFile in $InputFiles) {
            $resolvedFile = Get-Item $inputFile
            $entry = $archive.CreateEntry($resolvedFile.Name, [System.IO.Compression.CompressionLevel]::Optimal)
            $entry.LastWriteTime = $fixedTimestamp

            $entryStream = $entry.Open()
            try {
                $sourceStream = [System.IO.File]::OpenRead($resolvedFile.FullName)
                try {
                    $sourceStream.CopyTo($entryStream)
                }
                finally {
                    $sourceStream.Dispose()
                }
            }
            finally {
                $entryStream.Dispose()
            }
        }
    }
    finally {
        $archive.Dispose()
    }
}
finally {
    $archiveStream.Dispose()
}