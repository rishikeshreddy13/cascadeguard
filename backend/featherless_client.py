"""Small Featherless client used by the first CascadeGuard backend step.

The API is OpenAI-compatible, but this module uses Python's standard library
so the first integration has no package or framework setup to hide the idea.
"""

from __future__ import annotations

import json
import os
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_BASE_URL = "https://api.featherless.ai/v1"
DEFAULT_MODEL = "Qwen/Qwen2.5-7B-Instruct"


class FeatherlessError(RuntimeError):
    """Raised when Featherless cannot complete a request."""


def chat_completion(
    messages: list[dict[str, str]],
    *,
    model: str | None = None,
    max_tokens: int = 120,
    temperature: float = 0.0,
    timeout_seconds: int = 30,
) -> dict[str, Any]:
    """Send one chat-completion request without exposing the API key."""

    api_key = os.getenv("FEATHERLESS_API_KEY")
    if not api_key:
        raise FeatherlessError(
            "FEATHERLESS_API_KEY is missing. Add it through the workspace secrets."
        )

    base_url = os.getenv("FEATHERLESS_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
    selected_model = model or os.getenv("FEATHERLESS_MODEL", DEFAULT_MODEL)
    payload = {
        "model": selected_model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    request = Request(
        f"{base_url}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "CascadeGuard/0.1",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            body = response.read().decode("utf-8")
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:500]
        raise FeatherlessError(
            f"Featherless returned HTTP {error.code}: {detail}"
        ) from error
    except URLError as error:
        raise FeatherlessError(f"Featherless request failed: {error.reason}") from error

    try:
        return json.loads(body)
    except json.JSONDecodeError as error:
        raise FeatherlessError("Featherless returned invalid JSON.") from error