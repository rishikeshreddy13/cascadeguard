"""Deterministic ranking of candidate intervention points."""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any

from backend.models import CascadeGraph


@dataclass(frozen=True)
class RankedIntervention:
    """A ranked, non-executing intervention recommendation."""

    node_id: str
    action: str
    score: float
    leverage: float
    evidence_confidence: float
    feasibility: float
    uncertainty_penalty: float
    covered_node_ids: tuple[str, ...]
    rationale: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def rank_interventions(
    graph: CascadeGraph,
    candidates: list[dict[str, Any]] | None = None,
) -> list[RankedIntervention]:
    """Rank candidates by graph reach, evidence, feasibility, and uncertainty."""

    candidate_specs = candidates or _candidates_from_graph(graph)
    nodes = {node.id: node for node in graph.nodes}
    risk_nodes = {
        node.id
        for node in graph.nodes
        if node.node_type in {"failure", "dependency", "impact"}
    }
    if not candidate_specs:
        return []

    ranked: list[RankedIntervention] = []
    for candidate in candidate_specs:
        node_id = str(candidate.get("node_id", ""))
        node = nodes.get(node_id)
        if node is None:
            raise ValueError(f"intervention candidate references unknown node: {node_id}")
        if node.node_type != "intervention":
            raise ValueError(f"candidate node is not an intervention: {node_id}")

        feasibility = float(candidate.get("feasibility", 0.5))
        if not 0 <= feasibility <= 1:
            raise ValueError("intervention feasibility must be between 0 and 1")

        covered_node_ids = tuple(
            edge.source_id
            for edge in graph.edges
            if edge.target_id == node_id
            and edge.relation == "mitigated_by"
            and edge.source_id in risk_nodes
        )
        unique_covered = tuple(dict.fromkeys(covered_node_ids))
        leverage = len(unique_covered) / max(len(risk_nodes), 1)
        uncertainty_penalty = 0.15 if not node.evidence_ids else 0.0
        score = (
            0.5 * leverage
            + 0.3 * node.confidence
            + 0.2 * feasibility
            - uncertainty_penalty
        )
        ranked.append(
            RankedIntervention(
                node_id=node_id,
                action=str(candidate.get("action") or node.label),
                score=round(max(score, 0.0), 3),
                leverage=round(leverage, 3),
                evidence_confidence=node.confidence,
                feasibility=feasibility,
                uncertainty_penalty=uncertainty_penalty,
                covered_node_ids=unique_covered,
                rationale=(
                    f"Covers {len(unique_covered)} of {len(risk_nodes)} risk nodes; "
                    f"feasibility={feasibility:.2f}; "
                    f"evidence_confidence={node.confidence:.2f}."
                ),
            )
        )

    return sorted(ranked, key=lambda item: (-item.score, item.node_id))


def _candidates_from_graph(graph: CascadeGraph) -> list[dict[str, Any]]:
    return [
        {"node_id": node.id, "action": node.label, "feasibility": 0.5}
        for node in graph.nodes
        if node.node_type == "intervention"
    ]