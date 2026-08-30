import json
import os
import urllib.error
import urllib.request


def invoke(environment, path, body=b"{}", timeout=25):
    base_url = os.environ[f"{environment.upper()}_APP_URL"].rstrip("/")
    secret = os.environ[f"{environment.upper()}_CRON_SECRET"]
    request = urllib.request.Request(
        f"{base_url}{path}",
        method="POST",
        headers={
            "Authorization": f"Bearer {secret}",
            "Content-Type": "application/json",
            "User-Agent": "rive-aws-job-runner/2.0",
        },
        data=body,
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.status


def handle_sqs(records):
    failures = []
    results = []
    for record in records:
        message_id = record.get("messageId", "unknown")
        try:
            body = json.loads(record.get("body", "{}"))
            environment = body.get("environment")
            if environment not in ("dev", "prod"):
                raise ValueError("Invalid migration environment")
            status = invoke(
                environment,
                "/api/internal/migrations/worker",
                json.dumps(body).encode("utf-8"),
                timeout=310,
            )
            if status < 200 or status >= 300:
                raise RuntimeError(f"Worker returned {status}")
            results.append({"messageId": message_id, "status": status})
        except Exception as error:
            print(json.dumps({"messageId": message_id, "migrationWorkerError": type(error).__name__}))
            failures.append({"itemIdentifier": message_id})
    print(json.dumps({"migrationResults": results, "failureCount": len(failures)}))
    return {"batchItemFailures": failures}


def handler(event, _context):
    records = event.get("Records", [])
    if records and all(record.get("eventSource") == "aws:sqs" for record in records):
        return handle_sqs(records)

    targets = event.get("targets", [])
    results = []

    for target in targets:
        environment = target["environment"]
        path = target["path"]
        try:
            status = invoke(environment, path)
            results.append({"environment": environment, "path": path, "status": status})
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
