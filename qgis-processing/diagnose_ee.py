#!/usr/bin/env python3
"""
Earth Engine diagnostic.

Works through the chain in the order it actually breaks — environment, credentials,
authentication, per-service init, then live tile endpoints — and stops being useful
only once it has told you which link failed and what to do about it.

    cd qgis-processing
    python diagnose_ee.py            # checks config + EE directly
    python diagnose_ee.py --live     # also hits a running server on $PORT

Exit code is 0 if everything passed, 1 otherwise.
"""

import argparse
import json
import os
import sys
import time
import traceback

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# ── output helpers ───────────────────────────────────────────────────────────
GREEN, RED, YELLOW, DIM, BOLD, RESET = (
    "\033[32m", "\033[31m", "\033[33m", "\033[2m", "\033[1m", "\033[0m"
)
if not sys.stdout.isatty():
    GREEN = RED = YELLOW = DIM = BOLD = RESET = ""

failures: list[str] = []
warnings: list[str] = []


def section(title: str) -> None:
    print(f"\n{BOLD}{title}{RESET}")
    print("─" * len(title))


def ok(msg: str) -> None:
    print(f"  {GREEN}✓{RESET} {msg}")


def fail(msg: str, hint: str = "") -> None:
    print(f"  {RED}✗{RESET} {msg}")
    if hint:
        print(f"    {DIM}→ {hint}{RESET}")
    failures.append(msg)


def warn(msg: str, hint: str = "") -> None:
    print(f"  {YELLOW}!{RESET} {msg}")
    if hint:
        print(f"    {DIM}→ {hint}{RESET}")
    warnings.append(msg)


def info(msg: str) -> None:
    print(f"    {DIM}{msg}{RESET}")


# ── 1. environment ───────────────────────────────────────────────────────────
def check_env() -> dict:
    section("1. Environment")

    env_path = os.path.join(SCRIPT_DIR, ".env")
    if os.path.exists(env_path):
        ok(f".env found at {env_path}")
    else:
        fail(
            ".env not found in qgis-processing/",
            "Create it with EARTHENGINE_PROJECT, GOOGLE_APPLICATION_CREDENTIALS, EE_SERVICE_ACCOUNT",
        )

    try:
        from dotenv import load_dotenv

        load_dotenv(env_path)
    except ImportError:
        fail("python-dotenv not installed", "pip install -r requirements-local.txt")
        return {}

    values = {}
    for key, required in [
        ("EARTHENGINE_PROJECT", True),
        ("GOOGLE_APPLICATION_CREDENTIALS", True),
        ("EE_SERVICE_ACCOUNT", False),
        ("PORT", False),
    ]:
        val = os.getenv(key, "")
        values[key] = val
        if val:
            shown = val if key in ("EARTHENGINE_PROJECT", "PORT") else f"{val[:28]}…"
            ok(f"{key} = {shown}")
        elif required:
            fail(f"{key} is not set")
        else:
            warn(f"{key} is not set", "Optional, but usually needed for service-account auth")

    return values


# ── 2. credentials file ──────────────────────────────────────────────────────
def check_credentials(env: dict) -> str | None:
    section("2. Service account credentials")

    raw = env.get("GOOGLE_APPLICATION_CREDENTIALS", "")
    if not raw:
        fail("No credentials path configured")
        return None

    path = raw if os.path.isabs(raw) else os.path.join(SCRIPT_DIR, raw)
    if not os.path.exists(path):
        fail(
            f"Credentials file missing: {path}",
            "Download the service-account JSON from Google Cloud → IAM → Service Accounts",
        )
        return None
    ok(f"Credentials file exists ({os.path.getsize(path)} bytes)")

    try:
        with open(path) as f:
            creds = json.load(f)
    except json.JSONDecodeError as e:
        fail(f"Credentials file is not valid JSON: {e}")
        return None

    for field in ("client_email", "private_key", "project_id", "type"):
        if creds.get(field):
            if field == "client_email":
                ok(f"client_email = {creds[field]}")
            elif field == "project_id":
                ok(f"project_id = {creds[field]}")
            else:
                ok(f"{field} present")
        else:
            fail(f"Credentials JSON missing '{field}'")

    declared = env.get("EE_SERVICE_ACCOUNT", "")
    actual = creds.get("client_email", "")
    if declared and actual and declared != actual:
        warn(
            "EE_SERVICE_ACCOUNT does not match the JSON's client_email",
            f".env says {declared}, JSON says {actual}",
        )

    ee_project = env.get("EARTHENGINE_PROJECT", "")
    cred_project = creds.get("project_id", "")
    if ee_project and cred_project and ee_project != cred_project:
        warn(
            "EARTHENGINE_PROJECT differs from the credentials' project_id",
            f"{ee_project} vs {cred_project} — fine if the SA is registered on both, "
            "otherwise EE will reject the request",
        )

    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = path
    return path


# ── 3. Earth Engine auth ─────────────────────────────────────────────────────
def check_ee_auth(env: dict, cred_path: str | None) -> bool:
    section("3. Earth Engine authentication")

    try:
        import ee
    except ImportError:
        fail("earthengine-api not installed", "pip install earthengine-api")
        return False
    ok(f"earthengine-api imported (version {getattr(ee, '__version__', 'unknown')})")

    project = env.get("EARTHENGINE_PROJECT") or "josh-geo-the-second"

    try:
        if cred_path:
            with open(cred_path) as f:
                sa_email = json.load(f).get("client_email")
            credentials = ee.ServiceAccountCredentials(sa_email, cred_path)
            ee.Initialize(credentials, project=project)
            ok(f"ee.Initialize() succeeded as {sa_email}")
        else:
            ee.Initialize(project=project)
            ok("ee.Initialize() succeeded with default credentials")
    except Exception as e:
        fail(f"ee.Initialize() failed: {type(e).__name__}: {e}")
        msg = str(e).lower()
        if "not registered" in msg or "not signed up" in msg:
            info(f"Register the service account for Earth Engine: https://signup.earthengine.google.com/")
        elif "permission" in msg or "403" in msg:
            info("The service account lacks the Earth Engine Resource Viewer/Writer role on this project")
        elif "quota" in msg or "429" in msg:
            info("Quota exceeded — wait, or request more capacity in the EE project settings")
        return False

    # Round-trip a trivial computation: proves the token is actually usable,
    # not just that Initialize() didn't throw.
    try:
        started = time.monotonic()
        value = ee.Number(1).add(1).getInfo()
        elapsed = (time.monotonic() - started) * 1000
        if value == 2:
            ok(f"Live round-trip to EE servers OK ({elapsed:.0f}ms)")
        else:
            fail(f"EE returned an unexpected value: {value}")
            return False
    except Exception as e:
        fail(f"EE round-trip failed: {type(e).__name__}: {e}",
             "Initialize() succeeded but the API rejects real requests — usually auth scope or quota")
        return False

    # Confirm the datasets the services actually read are reachable.
    for name, asset, kind in [
        ("NEX-GDDP-CMIP6 (temperature, precipitation)", "NASA/GDDP-CMIP6", "collection"),
        ("MODIS LST (urban heat)", "MODIS/061/MOD11A1", "collection"),
        ("GRACE (groundwater)", "NASA/GRACE/MASS_GRIDS/LAND", "collection"),
        ("SRTM (topographic relief)", "USGS/SRTMGL1_003", "image"),
    ]:
        try:
            if kind == "collection":
                ee.ImageCollection(asset).first().getInfo()
            else:
                ee.Image(asset).getInfo()
            ok(f"{name} readable")
        except Exception as e:
            fail(f"{name} unreachable: {type(e).__name__}: {str(e)[:120]}")

    return True


# ── 4. per-service init ──────────────────────────────────────────────────────
def check_services(env: dict) -> None:
    section("4. Climate services")

    sys.path.insert(0, os.path.join(SCRIPT_DIR, "services"))
    sys.path.insert(0, SCRIPT_DIR)
    project = env.get("EARTHENGINE_PROJECT") or "josh-geo-the-second"

    services = [
        ("nasa_ee_climate", "NASAEEClimateService", {"ee_project": project}),
        ("urban_heat_island", "UrbanHeatIslandService", {"ee_project": project}),
        ("precipitation_drought", "PrecipitationDroughtService", {"ee_project": project}),
        ("topographic_relief", "TopographicReliefService", {}),
        ("urban_expansion", "UrbanExpansionService", {"ee_project": project}),
        ("grace_groundwater", "GRACEGroundwaterService", {"ee_project": project}),
        ("metro_humidity", "MetroHumidityService", {"ee_project": project}),
        ("noaa_sea_level", "NOAASeaLevelService", {}),
    ]

    for module_name, class_name, kwargs in services:
        try:
            module = __import__(module_name)
            cls = getattr(module, class_name)
        except Exception as e:
            fail(f"{class_name}: import failed — {type(e).__name__}: {e}")
            continue

        try:
            instance = cls(**kwargs)
        except Exception as e:
            fail(f"{class_name}: constructor raised {type(e).__name__}: {e}")
            continue

        initialized = getattr(instance, "initialized", None)
        if initialized is True:
            ok(f"{class_name} initialized")
        elif initialized is False:
            fail(f"{class_name} constructed but initialized=False",
                 "Its internal ee.Initialize() failed — check the logs it printed above")
        else:
            ok(f"{class_name} constructed (no 'initialized' flag — not EE-backed)")


# ── 5. live endpoints ────────────────────────────────────────────────────────
def check_live(env: dict) -> None:
    section("5. Live server endpoints")

    try:
        import requests
    except ImportError:
        warn("requests not installed — skipping live checks", "pip install requests")
        return

    port = env.get("PORT") or "5001"
    base = f"http://localhost:{port}"

    try:
        r = requests.get(f"{base}/health", timeout=5)
        r.raise_for_status()
        ok(f"Server responding on {base}")
    except Exception:
        fail(f"No server on {base}",
             f"Start it: cd qgis-processing && python climate_server.py")
        return

    try:
        r = requests.get(f"{base}/api/climate/status", timeout=15)
        status = r.json()
        for name, ready in (status.get("services") or status.get("ee_services") or {}).items():
            (ok if ready else fail)(f"{name}: {'ready' if ready else 'NOT initialized'}")
        if "message" in status:
            info(status["message"])
    except Exception as e:
        fail(f"/api/climate/status failed: {e}")

    endpoints = [
        ("temperature anomaly", "/api/climate/temperature-projection/tiles?year=2050&scenario=rcp45"),
        ("precipitation & drought", "/api/climate/precipitation-drought/tiles?year=2050&scenario=rcp45"),
        ("urban heat island", "/api/climate/urban-heat-island/tiles"),
        ("topographic relief", "/api/climate/topographic-relief/tiles"),
        ("groundwater (GRACE)", "/api/climate/groundwater/tiles"),
    ]
    for label, path in endpoints:
        try:
            started = time.monotonic()
            r = requests.get(f"{base}{path}", timeout=45)
            elapsed = time.monotonic() - started
            if r.status_code != 200:
                fail(f"{label}: HTTP {r.status_code}")
                info(r.text[:200])
                continue
            body = r.json()
            if body.get("tile_url") or body.get("tiles") or body.get("url"):
                ok(f"{label}: tile URL returned ({elapsed:.1f}s)")
            elif body.get("error"):
                fail(f"{label}: {body['error']}")
            else:
                warn(f"{label}: 200 but no tile_url in response")
                info(json.dumps(body)[:200])
        except Exception as e:
            fail(f"{label}: {type(e).__name__}: {str(e)[:120]}")


# ── main ─────────────────────────────────────────────────────────────────────
def main() -> int:
    parser = argparse.ArgumentParser(description="Diagnose Earth Engine setup")
    parser.add_argument("--live", action="store_true",
                        help="also test a running climate_server.py")
    parser.add_argument("--traceback", action="store_true",
                        help="print full tracebacks on unexpected errors")
    args = parser.parse_args()

    print(f"{BOLD}Earth Engine diagnostic{RESET}")
    print(f"{DIM}{SCRIPT_DIR}{RESET}")

    try:
        env = check_env()
        cred_path = check_credentials(env)
        authenticated = check_ee_auth(env, cred_path)
        if authenticated:
            check_services(env)
        else:
            section("4. Climate services")
            warn("Skipped — Earth Engine authentication failed above")
        if args.live:
            check_live(env)
    except Exception as e:
        print(f"\n{RED}Diagnostic crashed: {type(e).__name__}: {e}{RESET}")
        if args.traceback:
            traceback.print_exc()
        return 1

    section("Summary")
    if not failures and not warnings:
        print(f"  {GREEN}Everything passed.{RESET}")
    if warnings:
        print(f"  {YELLOW}{len(warnings)} warning(s){RESET}")
        for w in warnings:
            print(f"    · {w}")
    if failures:
        print(f"  {RED}{len(failures)} failure(s){RESET}")
        for f in failures:
            print(f"    · {f}")
        print(f"\n  {DIM}Fix the first failure listed — later ones are usually downstream of it.{RESET}")
    print()
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
