import json
import os
import urllib.error
import urllib.request


def handler(event, _context):
    targets = event.get("targets", [])
    results = []

    for target in targets:
        environment = target["environment"]
        path = target["path"]
        base_url = os.environ[f"{environment.upper()}_APP_URL"].rstrip("/")
        secret = os.environ[f"{environment.upper()}_CRON_SECRET"]
        request = urllib.request.Request(
            f"{base_url}{path}",
            method="POST",
            headers={
                "Authorization": f"Bearer {secret}",
                "Content-Type": "application/json",
                "User-Agent": "rive-aws-job-runner/1.0",
            },
            data=b"{}",
        )

        try:
            with urllib.request.urlopen(request, timeout=25) as response:
                results.append(
                    {
                        "environment": environment,
                        "path": path,
                        "status": response.status,
                    }
                )
        except urllib.error.HTTPError as error:
            results.append(
                {
                    "environment": environment,
                    "path": path,
                    "status": error.code,
                    "error": error.read(500).decode("utf-8", errors="replace"),
                }
            )
        except Exception as error:
            results.append(
                {
                    "environment": environment,
                    "path": path,
                    "status": 0,
                    "error": str(error),
                }
            )

    failures = [result for result in results if result["status"] < 200 or result["status"] >= 300]
    print(json.dumps({"results": results}))
    if failures:
        raise RuntimeError(f"{len(failures)} scheduled Rive jobs failed")
    return {"results": results}
