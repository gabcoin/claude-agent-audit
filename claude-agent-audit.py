#!/usr/bin/env python3
"""
Claude Code Agent Audit
Portable local-history analyzer for Claude Code sessions.

Works on Windows, macOS, and Linux.
Python 3.9+ recommended.

Examples:
    python claude-agent-audit.py
    python claude-agent-audit.py --project numerologia
    python claude-agent-audit.py --session ff29b6fc-beae-40e5-8e58-bdec0236c374
    python claude-agent-audit.py --output agent-audit.txt
    python claude-agent-audit.py --json agent-audit.json
    python claude-agent-audit.py --top 50
"""

import argparse
import json
import os
import platform
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

# Avoid Windows cp1252 crashes when prompts contain chars like →.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def default_claude_dir() -> Path:
    env = os.environ.get("CLAUDE_CONFIG_DIR")
    if env:
        return Path(env).expanduser()
    return Path.home() / ".claude"


def safe_text(value: Any) -> str:
    if value is None:
        return ""
    try:
        return str(value).replace("\x00", "")
    except Exception:
        return repr(value)


def shorten(value: Any, limit: int = 900) -> str:
    text = safe_text(value)
    if len(text) <= limit:
        return text
    return text[:limit] + "\n...[truncated]"


def content_text(content: Any) -> str:
    if isinstance(content, str):
        return content

    if not isinstance(content, list):
        return ""

    parts: List[str] = []

    for item in content:
        if not isinstance(item, dict):
            continue

        kind = item.get("type")

        if kind == "text":
            parts.append(safe_text(item.get("text")))

        elif kind == "tool_result":
            val = item.get("content")
            if isinstance(val, str):
                parts.append(val)
            elif isinstance(val, list):
                for child in val:
                    if isinstance(child, dict) and child.get("type") == "text":
                        parts.append(safe_text(child.get("text")))

    return "\n".join(p for p in parts if p)


def load_jsonl(path: Path) -> tuple[List[Dict[str, Any]], int]:
    records: List[Dict[str, Any]] = []
    failed = 0

    try:
        with path.open("r", encoding="utf-8", errors="replace") as fh:
            for line_no, line in enumerate(fh, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                    if isinstance(obj, dict):
                        obj["_line_no"] = line_no
                        records.append(obj)
                except Exception:
                    failed += 1
    except OSError:
        failed += 1

    return records, failed


def iter_tool_uses(record: Dict[str, Any]) -> Iterable[Dict[str, Any]]:
    msg = record.get("message") or {}
    content = msg.get("content") or []

    if not isinstance(content, list):
        return

    for item in content:
        if isinstance(item, dict) and item.get("type") == "tool_use":
            yield item


def usage_from_record(record: Dict[str, Any]) -> Dict[str, int]:
    msg = record.get("message") or {}
    usage = msg.get("usage") or {}

    def n(key: str) -> int:
        try:
            return int(usage.get(key, 0) or 0)
        except Exception:
            return 0

    return {
        "input_tokens": n("input_tokens"),
        "output_tokens": n("output_tokens"),
        "cache_read_input_tokens": n("cache_read_input_tokens"),
        "cache_creation_input_tokens": n("cache_creation_input_tokens"),
    }


def get_tool_result_map(records: List[Dict[str, Any]]) -> Dict[str, str]:
    out: Dict[str, str] = {}

    for record in records:
        msg = record.get("message") or {}
        content = msg.get("content") or []

        if not isinstance(content, list):
            continue

        for item in content:
            if not isinstance(item, dict) or item.get("type") != "tool_result":
                continue

            tool_id = item.get("tool_use_id")
            if tool_id:
                out[str(tool_id)] = content_text([item])

    return out


def project_label(path: Path, projects_root: Path) -> str:
    try:
        rel = path.relative_to(projects_root)
        return rel.parts[0] if rel.parts else path.parent.name
    except Exception:
        return path.parent.name


def is_subagent_file(path: Path) -> bool:
    return any(part.lower() == "subagents" for part in path.parts)


def find_jsonl_files(projects_root: Path, project_filter: Optional[str], session_filter: Optional[str]) -> List[Path]:
    files = list(projects_root.rglob("*.jsonl"))

    if project_filter:
        needle = project_filter.lower()
        files = [p for p in files if needle in str(p).lower()]

    if session_filter:
        needle = session_filter.lower()
        files = [p for p in files if needle in p.name.lower() or needle in str(p).lower()]

    return sorted(files)


def detect_agent_name(tool: str, inp: Dict[str, Any]) -> Optional[str]:
    agent = (
        inp.get("subagent_type")
        or inp.get("agent_type")
        or inp.get("agent")
    )

    tool_lower = tool.lower()

    looks_like_agent = (
        bool(agent)
        or tool_lower == "agent"
        or tool_lower == "task"
        or "agent" in tool_lower
    )

    if not looks_like_agent:
        return None

    return safe_text(
        agent
        or inp.get("name")
        or inp.get("description")
        or "(unspecified)"
    )


def nearby_parent_activity(
    records: List[Dict[str, Any]],
    start_index: int,
    max_events: int = 6,
) -> List[Dict[str, Any]]:
    events: List[Dict[str, Any]] = []
    seen = 0

    for later in records[start_index + 1:]:
        if seen >= max_events:
            break

        msg = later.get("message") or {}
        role = msg.get("role")
        content = msg.get("content") or []

        if not isinstance(content, list):
            continue

        parts: List[str] = []

        for item in content:
            if not isinstance(item, dict):
                continue

            kind = item.get("type")

            if kind == "text":
                text = shorten(item.get("text"), 350)
                if text.strip():
                    parts.append("TEXT: " + text)

            elif kind == "tool_use":
                name = safe_text(item.get("name"))
                inp = item.get("input") or {}
                detail = ""

                for key in ("file_path", "path", "pattern", "command", "query", "description"):
                    if key in inp and inp.get(key):
                        detail = f" | {key}: {shorten(inp.get(key), 180)}"
                        break

                parts.append(f"TOOL: {name}{detail}")

        if parts:
            events.append({
                "line": later.get("_line_no"),
                "role": role,
                "summary": "\n".join(parts),
            })
            seen += 1

    return events


def analyze_file(path: Path, projects_root: Path, include_details: bool = True) -> Dict[str, Any]:
    records, failed = load_jsonl(path)
    tool_results = get_tool_result_map(records)

    result: Dict[str, Any] = {
        "path": str(path),
        "project": project_label(path, projects_root),
        "session": path.stem,
        "is_subagent_file": is_subagent_file(path),
        "file_size_bytes": path.stat().st_size if path.exists() else 0,
        "parsed_lines": len(records),
        "failed_lines": failed,
        "record_types": Counter(),
        "tools": Counter(),
        "models": Counter(),
        "hooks": Counter(),
        "agents": Counter(),
        "usage": {
            "input_tokens": 0,
            "output_tokens": 0,
            "cache_read_input_tokens": 0,
            "cache_creation_input_tokens": 0,
        },
        "agent_calls": [],
    }

    for idx, record in enumerate(records):
        result["record_types"][safe_text(record.get("type", "(none)"))] += 1

        attachment = record.get("attachment") or {}
        hook = attachment.get("hookName")
        if hook:
            result["hooks"][safe_text(hook)] += 1

        msg = record.get("message") or {}

        model = msg.get("model")
        if model:
            result["models"][safe_text(model)] += 1

        usage = usage_from_record(record)
        for key, value in usage.items():
            result["usage"][key] += value

        for item in iter_tool_uses(record):
            tool = safe_text(item.get("name", "(unknown)"))
            result["tools"][tool] += 1

            inp = item.get("input") or {}
            if not isinstance(inp, dict):
                inp = {}

            agent_name = detect_agent_name(tool, inp)

            if agent_name and not result["is_subagent_file"]:
                result["agents"][agent_name] += 1

                if include_details:
                    tool_id = safe_text(item.get("id"))
                    result["agent_calls"].append({
                        "line": record.get("_line_no"),
                        "tool": tool,
                        "tool_use_id": tool_id,
                        "agent": agent_name,
                        "description": safe_text(inp.get("description")),
                        "prompt": safe_text(inp.get("prompt")),
                        "result": tool_results.get(tool_id, ""),
                        "nearby_parent_activity": nearby_parent_activity(records, idx),
                    })

    return result


def counter_to_dict(c: Counter) -> Dict[str, int]:
    return dict(c.most_common())


def json_safe_session(session: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(session)
    for key in ("record_types", "tools", "models", "hooks", "agents"):
        out[key] = counter_to_dict(out[key])
    return out


def format_num(n: int) -> str:
    return f"{n:,}"


def render_text(sessions: List[Dict[str, Any]], top: int, details: bool) -> str:
    global_tools = Counter()
    global_agents = Counter()
    global_models = Counter()

    total_parent_sessions = 0
    total_agent_calls = 0
    total_failed = 0

    totals = {
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_read_input_tokens": 0,
        "cache_creation_input_tokens": 0,
    }

    for s in sessions:
        global_tools.update(s["tools"])
        global_agents.update(s["agents"])
        global_models.update(s["models"])
        total_failed += s["failed_lines"]

        if not s["is_subagent_file"]:
            total_parent_sessions += 1
            total_agent_calls += sum(s["agents"].values())

        for key in totals:
            totals[key] += s["usage"][key]

    lines: List[str] = []

    lines.append("=" * 96)
    lines.append("CLAUDE CODE AGENT AUDIT")
    lines.append("=" * 96)
    lines.append(f"Platform:               {platform.system()} {platform.release()}")
    lines.append(f"Python:                 {platform.python_version()}")
    lines.append(f"Session files scanned:  {len(sessions)}")
    lines.append(f"Parent session files:   {total_parent_sessions}")
    lines.append(f"Agent calls detected:   {total_agent_calls}")
    lines.append(f"JSON parse failures:    {total_failed}")
    lines.append("")
    lines.append("=== TOKEN USAGE FOUND IN LOGS ===")
    lines.append(f"Input tokens:           {format_num(totals['input_tokens'])}")
    lines.append(f"Output tokens:          {format_num(totals['output_tokens'])}")
    lines.append(f"Cache read tokens:      {format_num(totals['cache_read_input_tokens'])}")
    lines.append(f"Cache creation tokens:  {format_num(totals['cache_creation_input_tokens'])}")

    lines.append("")
    lines.append("=== GLOBAL TOOL USE ===")
    for name, count in global_tools.most_common(top):
        lines.append(f"{count:7}  {name}")

    lines.append("")
    lines.append("=== AGENTS ===")
    if global_agents:
        for name, count in global_agents.most_common(top):
            lines.append(f"{count:7}  {name}")
    else:
        lines.append("No explicit Agent/Task calls detected.")

    lines.append("")
    lines.append("=== MODELS ===")
    for name, count in global_models.most_common(top):
        lines.append(f"{count:7}  {name}")

    parent_sessions = [s for s in sessions if not s["is_subagent_file"]]

    ranked_agents = sorted(
        parent_sessions,
        key=lambda s: sum(s["agents"].values()),
        reverse=True,
    )

    lines.append("")
    lines.append("=== MOST AGENT-HEAVY SESSIONS ===")

    shown = 0
    for s in ranked_agents:
        agent_count = sum(s["agents"].values())
        if agent_count <= 0:
            continue

        lines.append("")
        lines.append(s["path"])
        lines.append(f"  Project:        {s['project']}")
        lines.append(f"  Agents:         {agent_count}")
        lines.append(f"  Tools:          {sum(s['tools'].values())}")
        lines.append(f"  Output:         {format_num(s['usage']['output_tokens'])}")
        lines.append(f"  Cache read:     {format_num(s['usage']['cache_read_input_tokens'])}")
        lines.append(f"  Cache creation: {format_num(s['usage']['cache_creation_input_tokens'])}")

        if s["agents"]:
            lines.append("  Agent mix:")
            for agent, count in s["agents"].most_common():
                lines.append(f"    {count:4}  {agent}")

        shown += 1
        if shown >= top:
            break

    ranked_context = sorted(
        parent_sessions,
        key=lambda s: s["usage"]["cache_read_input_tokens"],
        reverse=True,
    )

    lines.append("")
    lines.append("=== HEAVIEST SESSIONS BY CACHE READ ===")

    for s in ranked_context[:top]:
        lines.append(
            f"{format_num(s['usage']['cache_read_input_tokens']):>16}  "
            f"agents={sum(s['agents'].values()):<3}  "
            f"tools={sum(s['tools'].values()):<5}  "
            f"{s['path']}"
        )

    if details:
        lines.append("")
        lines.append("=" * 96)
        lines.append("INDIVIDUAL AGENT CALLS")
        lines.append("=" * 96)

        index = 0

        for s in parent_sessions:
            for call in s["agent_calls"]:
                index += 1

                lines.append("")
                lines.append("#" * 96)
                lines.append(f"AGENT CALL #{index}")
                lines.append("#" * 96)
                lines.append(f"Session:     {s['path']}")
                lines.append(f"Project:     {s['project']}")
                lines.append(f"JSONL line:  {call['line']}")
                lines.append(f"Agent:       {call['agent']}")
                lines.append(f"Description: {call['description']}")
                lines.append(f"Tool ID:     {call['tool_use_id']}")

                lines.append("")
                lines.append("--- PROMPT SENT TO AGENT ---")
                lines.append(shorten(call["prompt"], 1800) or "[No prompt captured]")

                lines.append("")
                lines.append("--- AGENT RESULT ---")
                lines.append(shorten(call["result"], 1800) or "[No directly matched result found]")

                lines.append("")
                lines.append("--- PARENT ACTIVITY AFTER AGENT ---")

                nearby = call["nearby_parent_activity"]
                if not nearby:
                    lines.append("[No nearby activity found]")
                else:
                    for event in nearby:
                        lines.append("")
                        lines.append(f"Line {event['line']} | role={event['role']}")
                        lines.append(event["summary"])

    return "\n".join(lines) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit Claude Code local sessions, tool usage, agent calls, and token/cache usage."
    )

    parser.add_argument(
        "--claude-dir",
        type=Path,
        default=default_claude_dir(),
        help="Claude config directory. Default: ~/.claude or CLAUDE_CONFIG_DIR.",
    )

    parser.add_argument(
        "--project",
        help="Only analyze paths containing this project text.",
    )

    parser.add_argument(
        "--session",
        help="Only analyze a session whose path/name contains this text or UUID.",
    )

    parser.add_argument(
        "--output",
        type=Path,
        help="Write text report to this UTF-8 file.",
    )

    parser.add_argument(
        "--json",
        dest="json_output",
        type=Path,
        help="Also write machine-readable JSON report.",
    )

    parser.add_argument(
        "--top",
        type=int,
        default=30,
        help="Number of top rows to show. Default: 30.",
    )

    parser.add_argument(
        "--no-details",
        action="store_true",
        help="Skip full prompt/result details for each agent call.",
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()

    claude_dir = args.claude_dir.expanduser().resolve()
    projects_root = claude_dir / "projects"

    if not claude_dir.exists():
        print(f"ERROR: Claude directory not found: {claude_dir}", file=sys.stderr)
        print("Install/use Claude Code first, or pass --claude-dir PATH.", file=sys.stderr)
        return 2

    if not projects_root.exists():
        print(f"ERROR: Claude Code project history not found: {projects_root}", file=sys.stderr)
        print("Expected local histories under ~/.claude/projects/.", file=sys.stderr)
        return 2

    files = find_jsonl_files(
        projects_root,
        project_filter=args.project,
        session_filter=args.session,
    )

    if not files:
        print("No Claude Code JSONL session files matched the requested filters.", file=sys.stderr)
        return 1

    sessions: List[Dict[str, Any]] = []

    for path in files:
        sessions.append(
            analyze_file(
                path,
                projects_root=projects_root,
                include_details=not args.no_details,
            )
        )

    report = render_text(
        sessions,
        top=max(1, args.top),
        details=not args.no_details,
    )

    if args.output:
        output = args.output.expanduser()
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(report, encoding="utf-8")
        print(f"Text report written to: {output.resolve()}")
    else:
        print(report, end="")

    if args.json_output:
        json_path = args.json_output.expanduser()
        json_path.parent.mkdir(parents=True, exist_ok=True)

        payload = {
            "generated_by": "claude-agent-audit.py",
            "platform": platform.platform(),
            "python": platform.python_version(),
            "claude_dir": str(claude_dir),
            "projects_root": str(projects_root),
            "sessions": [json_safe_session(s) for s in sessions],
        }

        json_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        print(f"JSON report written to: {json_path.resolve()}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
