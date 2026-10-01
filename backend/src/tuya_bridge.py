"""Local-only Tuya LAN status bridge for TempmoX. Never prints credentials."""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".python_packages"))
try:
    from tinytuya import Device
except Exception:
    print("TINYTUYA_IMPORT_ERROR", file=sys.stderr)
    raise SystemExit(3)


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else "read"
    device = Device(
        os.environ["TUYA_DEVICE_ID"],
        os.environ["TUYA_DEVICE_IP"],
        os.environ["TUYA_LOCAL_KEY"],
        version=3.4,
    )
    device.set_socketPersistent(False)
    result = device.status()
    if result.get("Error") or "dps" not in result:
        code = str(result.get("Err", ""))
        suffix = f"={code}" if code.isdigit() else ""
        print(f"TUYA_STATUS_ERROR{suffix}", file=sys.stderr)
        return 2
    points = result["dps"]
    # Limit output to primitive datapoints; don't expose metadata or credentials.
    safe = [
        {"id": str(key), "type": type(value).__name__, "value": value}
        for key, value in points.items()
        if isinstance(value, (int, float, bool))
    ]
    print(json.dumps(safe, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception:
        # Avoid library exceptions that can include request details or secrets.
        print("TUYA_HELPER_RUNTIME_ERROR", file=sys.stderr)
        raise SystemExit(1)
