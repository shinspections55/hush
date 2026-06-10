$top250 = Get-Content top250.json -Raw | ConvertFrom-Json
$avgValueMap = @{}
foreach ($item in $top250) {
    if ($null -ne $item.prerank) {
        $avgValueMap[$item.prerank] = $item.avgValue
    }
}

$raw = Get-Content rankings-import-raw.txt
$players = New-Object System.Collections.Generic.List[PSObject]
$currentId = 0

for ($i = 0; $i -lt $raw.Length; $i++) {
    $line = $raw[$i].Trim()
    if ($line -match '^\d+$') {
        $rank = [int]$line
        $i++
        if ($i -ge $raw.Length) { break }
        $nameLine = $raw[$i].Trim()
        $i++
        if ($i -ge $raw.Length) { break }
        $posLine = $raw[$i].Trim()
        
        if ($nameLine -match '^(.*)\s+\((.*)\)$') {
            $name = $matches[1]
            $team = $matches[2]
        } else {
            $name = $nameLine
            $team = "FA"
        }
        
        $pos = "UNKNOWN"
        if ($posLine -match '^(WR|RB|QB|TE|K|DST)\d+') {
            $pos = $matches[1]
            if ($pos -eq "DST") { $pos = "DEF" }
        }
        
        $avgVal = 1
        if ($avgValueMap.ContainsKey($rank)) {
            $avgVal = $avgValueMap[$rank]
        }
        
        $players.Add([PSCustomObject]@{
            id = ++$currentId
            name = $name
            position = $pos
            team = $team
            prerank = $rank
            avgValue = $avgVal
        })
    }
}

$players | ConvertTo-Json -Depth 4 | Set-Content top250.generated.json
Write-Host "Parsed $($players.Count) players."
Write-Host "First 3:"
$players | Select-Object -First 3 | ForEach-Object { $_.name }
Write-Host "Last 3:"
$players | Select-Object -Last 3 | ForEach-Object { $_.name }
