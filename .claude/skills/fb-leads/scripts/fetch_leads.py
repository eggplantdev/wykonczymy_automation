#!/usr/bin/env python3
"""Fetch the most recent Facebook Lead Ads leads straight from the Meta Graph API.

Bypasses our DB entirely — this is the source of truth for what Meta actually has,
independent of whether the webhook stored a given lead. Reads META_PAGE_ACCESS_TOKEN
and META_PAGE_ID from the repo's .env.

Usage:
    python3 fetch_leads.py [N] [--form FORM_ID] [--json]

    N          how many recent leads to show (default 3)
    --form ID  pull from a specific leadgen form instead of auto-picking
    --json     emit raw JSON instead of a table
"""
import argparse
import json
import subprocess
import sys
import urllib.parse
from pathlib import Path

GRAPH = "https://graph.facebook.com/v21.0"


def load_env(repo_root: Path) -> dict:
    env = {}
    env_file = repo_root / ".env"
    if not env_file.exists():
        sys.exit(f"No .env at {env_file}")
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def graph_get(path: str, token: str, **params) -> dict:
    # Shell out to curl: the python.org Python often ships without a CA bundle,
    # so urllib fails SSL verification against graph.facebook.com. curl on macOS
    # uses the system trust store and just works.
    params["access_token"] = token
    url = f"{GRAPH}/{path}?{urllib.parse.urlencode(params)}"
    out = subprocess.run(["curl", "-sS", url], capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit(f"curl failed on /{path}: {out.stderr.strip()}")
    body = json.loads(out.stdout)
    if isinstance(body, dict) and "error" in body:
        sys.exit(f"Graph API error on /{path}: {json.dumps(body['error'])}")
    return body


def pick_form(page_id: str, token: str) -> dict:
    """Auto-pick the active form with the most leads."""
    forms = graph_get(f"{page_id}/leadgen_forms", token,
                       fields="id,name,leads_count,status", limit=50).get("data", [])
    active = [f for f in forms if f.get("leads_count", 0) > 0]
    if not active:
        sys.exit("No leadgen forms with leads found on this page.")
    return max(active, key=lambda f: f.get("leads_count", 0))


def flatten(field_data: list) -> dict:
    out = {}
    for f in field_data or []:
        vals = f.get("values") or []
        out[f.get("name", "?")] = ", ".join(vals)
    return out


def find(row: dict, *needles: str) -> str:
    for k, v in row.items():
        kl = k.lower()
        if any(n in kl for n in needles):
            return v
    return ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("n", nargs="?", type=int, default=3)
    ap.add_argument("--form")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    # scripts/ -> fb-leads/ -> skills/ -> .claude/ -> repo root
    repo_root = Path(__file__).resolve().parents[4]
    env = load_env(repo_root)
    token = env.get("META_PAGE_ACCESS_TOKEN")
    page = env.get("META_PAGE_ID")
    if not token or not page:
        sys.exit("META_PAGE_ACCESS_TOKEN / META_PAGE_ID missing from .env")

    form_id = args.form
    form_name = None
    if not form_id:
        form = pick_form(page, token)
        form_id, form_name = form["id"], form["name"]

    leads = graph_get(f"{form_id}/leads", token, limit=args.n,
                      fields="id,created_time,field_data").get("data", [])

    if args.json:
        print(json.dumps(leads, ensure_ascii=False, indent=2))
        return

    label = form_name or form_id
    print(f"Form: {label}  ({len(leads)} shown)\n")
    for i, lead in enumerate(leads, 1):
        row = flatten(lead.get("field_data"))
        name = find(row, "full name", "full_name", "name")
        phone = find(row, "phone")
        email = find(row, "email", "e-mail")
        rest = {k: v for k, v in row.items()
                if not any(t in k.lower() for t in ("name", "phone", "email", "e-mail"))}
        print(f"{i}. {name or '(no name)'}   {lead.get('created_time', '')}")
        print(f"   phone: {phone or '-'}   email: {email or '-'}")
        for k, v in rest.items():
            print(f"   {k}: {v}")
        print()


if __name__ == "__main__":
    main()
