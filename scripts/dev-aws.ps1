param(
  [int]$LocalPort = 5433,
  [string]$Region = "ap-south-1",
  [ValidateSet("dev", "migrate", "status", "smoke", "migration-smoke", "cleanup-smoke", "inspect-smoke", "seed-portfolio", "seed-launch-film", "delete-launch-film")]
  [string]$Action = "dev"
)

$ErrorActionPreference = "Stop"

function Require-Command([string]$Name, [string]$InstallHint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is required. $InstallHint"
  }
}

function Test-LocalPort([int]$Port) {
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $task = $client.ConnectAsync("127.0.0.1", $Port)
    return $task.Wait(250) -and $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

Require-Command "aws" "Install AWS CLI v2 and sign in with AWS SSO."
Require-Command "session-manager-plugin" "Run: winget install Amazon.SessionManagerPlugin"

$caBundlePath = Join-Path ([System.IO.Path]::GetTempPath()) "rive-rds-global-bundle.pem"
$caBundleMaxAge = [DateTime]::UtcNow.AddDays(-7)
$caBundleNeedsRefresh =
  -not (Test-Path -LiteralPath $caBundlePath) -or
  (Get-Item -LiteralPath $caBundlePath).LastWriteTimeUtc -lt $caBundleMaxAge

if ($caBundleNeedsRefresh) {
  Invoke-WebRequest `
    -Uri "https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem" `
    -OutFile $caBundlePath `
    -UseBasicParsing
}

$caBundle = Get-Content -LiteralPath $caBundlePath -Raw
if ($caBundle -notmatch "-----BEGIN CERTIFICATE-----") {
  throw "The downloaded Amazon RDS CA bundle is invalid."
}

if (Test-LocalPort $LocalPort) {
  throw "Local port $LocalPort is already in use. Stop the existing process or choose another port."
}

$instanceId = aws ec2 describe-instances `
  --region $Region `
  --filters "Name=tag:Name,Values=rive-app" "Name=instance-state-name,Values=running" `
  --query "Reservations[0].Instances[0].InstanceId" `
  --output text
if ($LASTEXITCODE -ne 0 -or -not $instanceId -or $instanceId -eq "None") {
  throw "The running rive-app EC2 instance could not be found. Refresh AWS SSO and try again."
}

$databaseHost = aws rds describe-db-instances `
  --region $Region `
  --db-instance-identifier rive-postgres `
  --query "DBInstances[0].Endpoint.Address" `
  --output text
if ($LASTEXITCODE -ne 0 -or -not $databaseHost -or $databaseHost -eq "None") {
  throw "The Rive RDS endpoint could not be found."
}

$remoteUrl = aws ssm get-parameter `
  --region $Region `
  --name "/rive/dev/DATABASE_URL" `
  --with-decryption `
  --query "Parameter.Value" `
  --output text
if ($LASTEXITCODE -ne 0 -or -not $remoteUrl -or $remoteUrl -eq "None") {
  throw "The development database URL could not be loaded from SSM."
}

$assetBucket = aws ssm get-parameter `
  --region $Region `
  --name "/rive/dev/ASSET_BUCKET" `
  --query "Parameter.Value" `
  --output text
if ($LASTEXITCODE -ne 0 -or -not $assetBucket -or $assetBucket -eq "None") {
  throw "The development asset bucket could not be loaded from SSM."
}

$escapedHost = [Regex]::Escape($databaseHost)
$localUrl = $remoteUrl -replace "@${escapedHost}:5432/", "@127.0.0.1:${LocalPort}/"
if ($localUrl -eq $remoteUrl) {
  throw "The SSM development database URL did not contain the expected RDS endpoint."
}

$outputLog = Join-Path ([System.IO.Path]::GetTempPath()) "rive-ssm-tunnel-$PID.out.log"
$errorLog = Join-Path ([System.IO.Path]::GetTempPath()) "rive-ssm-tunnel-$PID.err.log"
$existingPluginIds = @(Get-Process -Name "session-manager-plugin" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$sessionPluginIds = @()
$parameters = "host=$databaseHost,portNumber=5432,localPortNumber=$LocalPort"
$tunnel = Start-Process `
  -FilePath (Get-Command aws).Source `
  -ArgumentList @(
    "ssm", "start-session",
    "--region", $Region,
    "--target", $instanceId,
    "--document-name", "AWS-StartPortForwardingSessionToRemoteHost",
    "--parameters", $parameters
  ) `
  -WindowStyle Hidden `
  -RedirectStandardOutput $outputLog `
  -RedirectStandardError $errorLog `
  -PassThru

try {
  # Session Manager can take longer than 25 seconds to hand off to the local
  # plugin after a fresh AWS login. Keep the wait bounded, but leave enough
  # room for that authenticated startup path.
  $deadline = [DateTime]::UtcNow.AddSeconds(60)
  while (-not (Test-LocalPort $LocalPort)) {
    if ($tunnel.HasExited) {
      $details = if (Test-Path -LiteralPath $errorLog) { Get-Content -LiteralPath $errorLog -Raw } else { "" }
      throw "The AWS database tunnel exited before it was ready. $details"
    }
    if ([DateTime]::UtcNow -ge $deadline) {
      throw "The AWS database tunnel did not open local port $LocalPort within 60 seconds."
    }
    Start-Sleep -Milliseconds 300
  }

  $sessionPluginIds = @(Get-Process -Name "session-manager-plugin" -ErrorAction SilentlyContinue |
    Where-Object { $existingPluginIds -notcontains $_.Id } |
    Select-Object -ExpandProperty Id)

  $env:DATABASE_URL = $localUrl
  $env:DATABASE_SSL_REJECT_UNAUTHORIZED = "true"
  $env:DATABASE_SSL_SERVERNAME = $databaseHost
  $env:DATABASE_POOL_MAX = "4"
  $env:NODE_EXTRA_CA_CERTS = $caBundlePath
  $env:ASSET_BUCKET = $assetBucket
  $env:AWS_REGION = $Region

  Write-Host "Connected securely to the AWS development database through SSM." -ForegroundColor Green
  switch ($Action) {
    "dev" { npm run dev }
    "migrate" { npx prisma migrate deploy }
    "status" { npx prisma migrate status }
    "smoke" { node scripts/smoke-contracts.mjs }
    "migration-smoke" { node --experimental-strip-types --import ./scripts/hosted-module-loader.mjs scripts/smoke-migration.mjs }
    "cleanup-smoke" { node scripts/cleanup-contract-smoke.mjs }
    "inspect-smoke" { node scripts/inspect-contract-smoke.mjs }
    "seed-portfolio" { node scripts/seed-portfolio-media.mjs --email=atzgg132@gmail.com --apply }
    "seed-launch-film" {
      if (-not $env:LAUNCH_FILM_DEMO_EMAIL) {
        throw "Set LAUNCH_FILM_DEMO_EMAIL to the dedicated launch-film account before seeding."
      }
      $seedArgs = @("scripts/seed-launch-film-demo.mjs", "--email=$($env:LAUNCH_FILM_DEMO_EMAIL)")
      if ($env:LAUNCH_FILM_SEED_APPLY -eq "1") { $seedArgs += "--apply" }
      if ($env:LAUNCH_FILM_SEED_STATE) { $seedArgs += "--state=$($env:LAUNCH_FILM_SEED_STATE)" }
      node @seedArgs
    }
    "delete-launch-film" {
      if (-not $env:LAUNCH_FILM_DEMO_EMAIL) {
        throw "Set LAUNCH_FILM_DEMO_EMAIL to the dedicated launch-film account before deleting."
      }
      $deleteArgs = @("scripts/delete-launch-film-demo.mjs", "--email=$($env:LAUNCH_FILM_DEMO_EMAIL)")
      if ($env:LAUNCH_FILM_SEED_APPLY -eq "1") { $deleteArgs += "--apply" }
      node @deleteArgs
    }
  }
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  if ($tunnel -and -not $tunnel.HasExited) {
    Stop-Process -Id $tunnel.Id -Force
    $tunnel.WaitForExit()
  }
  # A slow aws -> session-manager-plugin handoff can occur after the startup
  # deadline. Discover children created by this invocation again so they do
  # not survive a failed tunnel attempt.
  $sessionPluginIds = @(Get-Process -Name "session-manager-plugin" -ErrorAction SilentlyContinue |
    Where-Object { $existingPluginIds -notcontains $_.Id } |
    Select-Object -ExpandProperty Id)
  foreach ($sessionPluginId in $sessionPluginIds) {
    $plugin = Get-Process -Id $sessionPluginId -ErrorAction SilentlyContinue
    if ($plugin -and $plugin.ProcessName -eq "session-manager-plugin") {
      Stop-Process -Id $sessionPluginId -Force -ErrorAction SilentlyContinue
    }
  }
  Start-Sleep -Milliseconds 500
  foreach ($log in @($outputLog, $errorLog)) {
    if (Test-Path -LiteralPath $log) {
      $removed = $false
      for ($attempt = 0; $attempt -lt 5 -and -not $removed; $attempt++) {
        try {
          Remove-Item -LiteralPath $log -Force -ErrorAction Stop
          $removed = $true
        } catch {
          Start-Sleep -Milliseconds 250
        }
      }
    }
  }
}
