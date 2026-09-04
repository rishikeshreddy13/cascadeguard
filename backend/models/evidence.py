"""Validated evidence records shared by all CascadeGuard tools."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(frozen=True)
class Evidence:
    """A source-backed claim with explicit uncertainty metadata."""

    source: str
    source_url: str
    timestamp: str
    location: dict[str, Any]
    claim: str
    data_type: str
    source_tier: str
    confidence: float
    confidence_basis: str
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        required_text = {
            "source": self.source,
            "source_url": self.source_url,
            "timestamp": self.timestamp,
            "claim": self.claim,
            "data_type": self.data_type,
            "source_tier": self.source_tier,
            "confidence_basis": self.confidence_basis,
        }
        for name, value in required_text.items():
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"evidence {name} must be a non-empty string")
        if not isinstance(self.location, dict) or not self.location:
            raise ValueError("evidence location must be a non-empty object")
        if not isinstance(self.confidence, (int, float)) or not 0 <= self.confidence <= 1:
            raise ValueError("evidence confidence must be between 0 and 1")

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-compatible representation for the agent context."""

        result = asdict(self)
        result["evidence_id"] = self.evidence_id
        return result

    @property
    def evidence_id(self) -> str:
        """Return a stable identifier for this exact source-backed claim."""

        canonical = json.dumps(
            {
                "source_url": self.source_url,
                "timestamp": self.timestamp,
                "claim": self.claim,
                "location": self.location,
            },
            sort_keys=True,
            separators=(",", ":"),
        )
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:16]