"""Small HTTP API for the CascadeGuard investigation loop.

The API exposes structured decisions and a safe investigation trace. It does
not return the model's raw response or hidden reasoning.

Run with:
    python -m backend.api
"""

from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from backend.agent import BoundedAgent
from backend.featherless_client import FeatherlessError


MAX_REQUEST_BYTES = 64 * 1024
MAX_AGENT_STEPS = 6


def _step_payload(step: Any) -> dict[str, Any]:
    """Return only user-safe, structured information from an agent step."""

    decision = step.decision
    tool_result = step.tool_result
    tool_summary = None
    if tool_result is not None:
        tool_summary = {
            "tool": tool_result.get("tool", ""),
            "count": tool_result.get("count", 0),
            "error": tool_result.get("error"),
        }

    trace = "Investigation decision recorded"
    if decision.get("action") == "call_tool":
        trace = f"Checking controlled tool: {decision.get('tool', 'unknown')}"
    elif decision.get("action") == "final":
        trace = "Provisional cascade decision assembled"

    return {
        "number": step.number,
        "action": decision.get("action", ""),
        "tool": decision.get("tool", ""),
        "what_i_need_next": decision.get("what_i_need_next", ""),
        "reason": decision.get("reason", ""),
        "trace": trace,
        "tool_summary": tool_summary,
    }


def _run_payload(run: Any) -> dict[str, Any]:
    warnings = []
    if run.graph_error:
        warnings.append(f"Cascade graph was rejected: {run.graph_error}")
    if run.intervention_error:
        warnings.append(
            f"Intervention ranking was unavailable: {run.intervention_error}"
        )

    return {
        "status": "ok",
        "goal": run.goal,
        "stopped_reason": run.stopped_reason,
        "steps": [_step_payload(step) for step in run.steps],
        "cascade_graph": (
            run.cascade_graph.to_dict() if run.cascade_graph is not None else None
        ),
        "ranked_interventions": [
            intervention.to_dict() for intervention in run.ranked_interventions
        ],
        "warnings": warnings,
    }


def _read_json(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    content_length = int(handler.headers.get("Content-Length", "0"))
    if content_length <= 0:
        raise ValueError("request body is required")
    if content_length > MAX_REQUEST_BYTES:
        raise ValueError("request body is too large")

    raw_body = handler.rfile.read(content_length)
    try:
        body = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("request body must be valid JSON") from error
    if not isinstance(body, dict):
        raise ValueError("request body must be a JSON object")
    return body


def _request_values(body: dict[str, Any]) -> tuple[str, int, str | None]:
    goal = body.get("goal")
    if not isinstance(goal, str) or not goal.strip():
        raise ValueError("goal must be a non-empty string")
    if len(goal) > 4_000:
        raise ValueError("goal is too long")

    max_steps = body.get("max_steps", 3)
    if isinstance(max_steps, bool) or not isinstance(max_steps, int):
        raise ValueError("max_steps must be an integer")
    if not 1 <= max_steps <= MAX_AGENT_STEPS:
        raise ValueError(f"max_steps must be between 1 and {MAX_AGENT_STEPS}")

    model = body.get("model")
    if model is not None and (not isinstance(model, str) or not model.strip()):
        raise ValueError("model must be a non-empty string when provided")
    return goal, max_steps, model


class CascadeGuardHandler(BaseHTTPRequestHandler):
    """Handle the minimal browser-facing API."""

    protocol_version = "HTTP/1.1"

    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        response = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(response)

    def do_OPTIONS(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
        self._send_json(204, {})

    def do_GET(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
        if self.path == "/api/health":
            self._send_json(200, {"status": "ok", "service": "cascadeguard"})
            return
        self._send_json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
        if self.path != "/api/analyze":
            self._send_json(404, {"error": "not found"})
            return

        try:
            body = _read_json(self)
            goal, max_steps, model = _request_values(body)
            run = BoundedAgent(max_steps=max_steps, model=model).run(goal)
        except ValueError as error:
            self._send_json(400, {"error": str(error)})
            return
        except FeatherlessError as error:
            self._send_json(502, {"error": str(error)})
            return
        except RuntimeError as error:
            self._send_json(502, {"error": str(error)})
            return

        self._send_json(200, _run_payload(run))

    def log_message(self, format: str, *args: Any) -> None:
        """Keep request logs concise while developing the hackathon demo."""

        print(f"[cascadeguard] {format % args}")


def run_server() -> None:
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    server = ThreadingHTTPServer((host, port), CascadeGuardHandler)
    print(f"CascadeGuard API listening on http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nCascadeGuard API stopped")
    finally:
        server.server_close()


if __name__ == "__main__":
    run_server()
