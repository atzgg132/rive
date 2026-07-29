$commands = @(
  'sudo ss -ltnp',
  'sudo docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"',
  'sudo docker logs --tail 120 rive-proxy 2>&1',
  'sudo journalctl -u caddy --no-pager -n 120',
  'sudo find /etc/caddy /opt/rive -maxdepth 3 -type f -print'
)
$payload = @{ InstanceIds = @('i-0ab917bc04f0fb304'); DocumentName = 'AWS-RunShellScript'; Parameters = @{ commands = $commands } } | ConvertTo-Json -Depth 5
Set-Content -LiteralPath proxy-debug.json -Value $payload -NoNewline
$env:AWS_PROFILE = 'rive-bootstrap'
$aws = 'C:\Program Files\Amazon\AWSCLIV2\aws.exe'
$id = & $aws ssm send-command --region ap-south-1 --cli-input-json file://proxy-debug.json --query 'Command.CommandId' --output text
Start-Sleep -Seconds 8
& $aws ssm get-command-invocation --region ap-south-1 --command-id $id --instance-id i-0ab917bc04f0fb304 --query StandardOutputContent --output text
Remove-Item -LiteralPath proxy-debug.json -Force -ErrorAction SilentlyContinue
