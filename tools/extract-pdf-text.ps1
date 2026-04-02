param(
  [Parameter(Mandatory = $true)]
  [string]$PdfPath,
  [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-PdfAsciiText {
  param([byte[]]$Bytes)

  return [Text.Encoding]::ASCII.GetString($Bytes)
}

function Get-ObjectMatches {
  param([string]$AsciiText)

  return [regex]::Matches($AsciiText, '(?ms)(\d+)\s+0\s+obj(.*?)endobj')
}

function Get-InflatedStreamText {
  param(
    [byte[]]$Bytes,
    [string]$AsciiText,
    [int]$ObjectNumber
  )

  $match = [regex]::Match(
    $AsciiText,
    "(?ms)$ObjectNumber\s+0\s+obj.*?/Length\s+(\d+).*?stream\r?\n"
  )

  if (-not $match.Success) {
    return $null
  }

  $length = [int]$match.Groups[1].Value
  $streamStart = $match.Index + $match.Length
  $streamBytes = New-Object byte[] $length
  [Array]::Copy($Bytes, $streamStart, $streamBytes, 0, $length)

  if ($streamBytes.Length -lt 6) {
    return $null
  }

  try {
    $input = New-Object IO.MemoryStream(, $streamBytes[2..($streamBytes.Length - 5)])
    $deflate = New-Object IO.Compression.DeflateStream($input, [IO.Compression.CompressionMode]::Decompress)
    $output = New-Object IO.MemoryStream
    $deflate.CopyTo($output)
    $deflate.Dispose()
    $input.Dispose()
    return [Text.Encoding]::ASCII.GetString($output.ToArray())
  } catch {
    return $null
  }
}

function New-UnicodeMap {
  param([string]$CMapText)

  $map = @{}
  foreach ($line in ($CMapText -split "`r?`n")) {
    if ($line -match '^<([0-9A-F]+)>\s+<([0-9A-F]+)>$') {
      $map[$matches[1].ToUpper()] = [char][convert]::ToInt32($matches[2], 16)
      continue
    }

    if ($line -match '^<([0-9A-F]+)>\s+<([0-9A-F]+)>\s+<([0-9A-F]+)>$') {
      $start = [convert]::ToInt32($matches[1], 16)
      $end = [convert]::ToInt32($matches[2], 16)
      $base = [convert]::ToInt32($matches[3], 16)

      for ($i = $start; $i -le $end; $i++) {
        $map[('{0:X4}' -f $i)] = [char]($base + ($i - $start))
      }
    }
  }

  return $map
}

function Decode-HexText {
  param(
    [string]$Hex,
    [hashtable]$Map
  )

  $builder = New-Object Text.StringBuilder

  for ($i = 0; $i -lt $Hex.Length; $i += 4) {
    $code = $Hex.Substring($i, [Math]::Min(4, $Hex.Length - $i)).ToUpper()
    if ($Map.ContainsKey($code)) {
      [void]$builder.Append($Map[$code])
    } else {
      [void]$builder.Append("[$code]")
    }
  }

  return $builder.ToString()
}

function Get-PageText {
  param(
    [string]$ContentText,
    [hashtable]$ResourceFontMaps
  )

  $lines = New-Object System.Collections.Generic.List[string]
  $currentFont = $null

  foreach ($rawLine in ($ContentText -split "`r?`n")) {
    $line = $rawLine.Trim()

    if ($line -match '^/([A-Za-z0-9]+)\s+[\d\.]+\s+Tf$') {
      $currentFont = $matches[1]
      continue
    }

    if (-not $currentFont -or -not $ResourceFontMaps.ContainsKey($currentFont)) {
      continue
    }

    $decodedParts = [regex]::Matches($line, '<([0-9A-F]+)>\s*Tj') | ForEach-Object {
      Decode-HexText $_.Groups[1].Value $ResourceFontMaps[$currentFont]
    }

    if ($decodedParts.Count -gt 0) {
      $textLine = ($decodedParts -join '')
      if ($textLine.Trim()) {
        $lines.Add($textLine)
      }
    }
  }

  return $lines
}

$pdfBytes = [IO.File]::ReadAllBytes($PdfPath)
$pdfText = Get-PdfAsciiText $pdfBytes
$objectMatches = Get-ObjectMatches $pdfText

$fontObjToMap = @{}
foreach ($objMatch in $objectMatches) {
  $objectNumber = [int]$objMatch.Groups[1].Value
  $objectBody = $objMatch.Groups[2].Value

  if ($objectBody -match '/Type\s*/Font' -and $objectBody -match '/ToUnicode\s+(\d+)\s+0\s+R') {
    $fontObjToMap[$objectNumber] = [int]$matches[1]
  }
}

$unicodeMaps = @{}
foreach ($mapObj in ($fontObjToMap.Values | Select-Object -Unique)) {
  $cmapText = Get-InflatedStreamText -Bytes $pdfBytes -AsciiText $pdfText -ObjectNumber $mapObj
  if ($cmapText) {
    $unicodeMaps[$mapObj] = New-UnicodeMap $cmapText
  }
}

$pageEntries = New-Object System.Collections.Generic.List[object]
foreach ($objMatch in $objectMatches) {
  $objectNumber = [int]$objMatch.Groups[1].Value
  $objectBody = $objMatch.Groups[2].Value

  if ($objectBody -notmatch '/Type\s*/Page\b') {
    continue
  }

  $fontMap = @{}
  foreach ($fontRef in [regex]::Matches($objectBody, '/([A-Za-z0-9]+)\s+(\d+)\s+0\s+R')) {
    $resourceName = $fontRef.Groups[1].Value
    $fontObject = [int]$fontRef.Groups[2].Value

    if ($fontObjToMap.ContainsKey($fontObject)) {
      $mapObject = $fontObjToMap[$fontObject]
      if ($unicodeMaps.ContainsKey($mapObject)) {
        $fontMap[$resourceName] = $unicodeMaps[$mapObject]
      }
    }
  }

  $contentRefs = [regex]::Matches($objectBody, '/Contents\s+((\[\s*)?((\d+)\s+0\s+R[\s]*)+(\])?)')
  $contentObjects = New-Object System.Collections.Generic.List[int]
  foreach ($contentRef in $contentRefs) {
    foreach ($numMatch in [regex]::Matches($contentRef.Value, '(\d+)\s+0\s+R')) {
      $contentObjects.Add([int]$numMatch.Groups[1].Value)
    }
  }

  $pageEntries.Add([pscustomobject]@{
      PageObject = $objectNumber
      FontMaps = $fontMap
      ContentObjects = $contentObjects
    })
}

$outputLines = New-Object System.Collections.Generic.List[string]
$pageNumber = 1

foreach ($page in $pageEntries) {
  $outputLines.Add("=== Page $pageNumber ===")

  foreach ($contentObject in $page.ContentObjects) {
    $contentText = Get-InflatedStreamText -Bytes $pdfBytes -AsciiText $pdfText -ObjectNumber $contentObject
    if (-not $contentText) {
      continue
    }

    foreach ($line in (Get-PageText -ContentText $contentText -ResourceFontMaps $page.FontMaps)) {
      $outputLines.Add($line)
    }
  }

  $outputLines.Add("")
  $pageNumber += 1
}

$finalText = $outputLines -join [Environment]::NewLine

if ($OutputPath) {
  [IO.File]::WriteAllText($OutputPath, $finalText)
} else {
  $finalText
}
