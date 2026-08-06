# Runs tests.html in headless Edge (or Chrome) and prints the result.
#
#   powershell -ExecutionPolicy Bypass -File tests\headless.ps1
#
# There is no node in this project's toolchain and no build step; a browser is the one
# runtime the game is guaranteed to have, so it is what runs the tests too.

$ErrorActionPreference = "Stop"

$candidates = @(
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
)

$browser = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { Write-Error "No Edge or Chrome found to run the harness."; exit 2 }

$root = Split-Path -Parent $PSScriptRoot
$url = "file:///" + (($root -replace '\\', '/')) + "/tests.html"
$dump = Join-Path $env:TEMP "spirit-idland-tests.html"

# --virtual-time-budget lets the page's scripts finish before the DOM is dumped; the suite
# itself uses an injected clock, so it never waits on real time.
#
# The browser writes policy chatter to stderr on some managed machines. Redirecting it would
# make PowerShell 5.1 treat a clean exit as a failure, so it is quieted at the source with
# --log-level and left alone here.
$ErrorActionPreference = "Continue"
& $browser --headless=new --disable-gpu --no-sandbox --log-level=3 --virtual-time-budget=20000 --dump-dom $url |
  Out-File -FilePath $dump -Encoding utf8
$ErrorActionPreference = "Stop"

$text = Get-Content $dump -Raw

foreach ($m in [regex]::Matches($text, '<li class="fail">(.*?)</li>')) {
  $line = ($m.Groups[1].Value -replace '</span><span[^>]*>', ' :: ') -replace '<[^>]+>', ''
  Write-Host $line -ForegroundColor Red
}

if ($text -match 'data-status="([a-z]+)" data-passed="(\d+)" data-total="(\d+)"') {
  $status = $matches[1]
  Write-Host "`n$($matches[2])/$($matches[3]) checks passed."
  if ($status -ne "pass") { exit 1 }
  exit 0
}

Write-Error "Could not read a result summary from the harness."
exit 2
