"""Deterministic Nepal evidence replay for the hackathon demo."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from backend.models import Evidence


REPLAY_PATH = Path(__file__).resolve().parents[2] / "data" / "nepal_flood_replay.json"


class ReplayError(RuntimeError):
    """Raised when the checked-in replay evidence is not usable."""


def fetch_nepal_replay() -> dict[str, Any]:
    """Return checked-in, source-linked evidence without making network calls."""

    try:
        scenario = json.loads(REPLAY_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ReplayError("Nepal replay evidence could not be loaded.") from error

    if not isinstance(scenario, dict):
        raise ReplayError("Nepal replay must contain a JSON object.")

    evidence: list[dict[str, Any]] = []
    for section_name in ("event", "infrastructure"):
        section = scenario.get(section_name)
        if not isinstance(section, dict) or not isinstance(section.get("evidence"), list):
            raise ReplayError(f"Nepal replay section is invalid: {section_name}")
        for raw_evidence in section["evidence"]:
            if not isinstance(raw_evidence, dict):
                raise ReplayError("Nepal replay contains an invalid evidence record.")
            try:
                evidence.append(
                    Evidence(
                        source=raw_evidence["source"],
                        source_url=raw_evidence["source_url"],
                        timestamp=raw_evidence["timestamp"],
                        location=raw_evidence["location"],
                        claim=raw_evidence["claim"],
                        data_type=raw_evidence["data_type"],
                        source_tier=raw_evidence["source_tier"],
                        confidence=raw_evidence["confidence"],
                        confidence_basis=raw_evidence["confidence_basis"],
                        metadata=raw_evidence.get("metadata", {}),
                    ).to_dict()
                )
            except (KeyError, TypeError, ValueError) as error:
                raise ReplayError("Nepal replay contains invalid evidence metadata.") from error

    return {
        "tool": "nepal_flood_replay",
        "mode": "replay",
        "scenario_id": scenario.get("scenario_id", "nepal-flood-2026"),
        "title": scenario.get("title", "Nepal flood replay"),
        "notice": scenario.get("description", "Checked-in replay evidence."),
        "source": "data/nepal_flood_replay.json",
        "retrieved_at": scenario.get("collected_at", ""),
        "query": {"scenario_id": scenario.get("scenario_id"), "mode": "replay"},
        "evidence": evidence,
        "count": len(evidence),
    }
