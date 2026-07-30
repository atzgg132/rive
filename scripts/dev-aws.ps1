param(
  [int]$LocalPort = 5433,
  [string]$Region = "ap-south-1"
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

$escapedHost = [Regex]::Escape($databaseHost)
$localUrl = $remoteUrl -replace "@${escapedHost}:5432/", "@127.0.0.1:${LocalPort}/"
if ($localUrl -eq $remoteUrl) {
  throw "The SSM development database URL did not contain the expected RDS endpoint."
}

$outputLog = Join-Path ([System.IO.Path]::GetTempPath()) "rive-ssm-tunnel-$PID.out.log"
$errorLog = Join-Path ([System.IO.Path]::GetTempPath()) "rive-ssm-tunnel-$PID.err.log"
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
  $deadline = [DateTime]::UtcNow.AddSeconds(25)
  while (-not (Test-LocalPort $LocalPort)) {
    if ($tunnel.HasExited) {
      $details = if (Test-Path -LiteralPath $errorLog) { Get-Content -LiteralPath $errorLog -Raw } else { "" }
      throw "The AWS database tunnel exited before it was ready. $details"
    }
    if ([DateTime]::UtcNow -ge $deadline) {
      throw "The AWS database tunnel did not open local port $LocalPort within 25 seconds."
    }
    Start-Sleep -Milliseconds 300
  }

  $env:DATABASE_URL = $localUrl
  $env:DATABASE_SSL_REJECT_UNAUTHORIZED = "true"
  $env:DATABASE_SSL_SERVERNAME = $databaseHost
  $env:DATABASE_POOL_MAX = "4"
  $env:NODE_EXTRA_CA_CERTS = $caBundlePath

  Write-Host "Connected securely to the AWS development database through SSM." -ForegroundColor Green
  npm run dev
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  if ($tunnel -and -not $tunnel.HasExited) {
    Stop-Process -Id $tunnel.Id -Force
    $tunnel.WaitForExit()
  }
  foreach ($log in @($outputLog, $errorLog)) {
    if (Test-Path -LiteralPath $log) {
      Remove-Item -LiteralPath $log -Force
    }
  }
}
