"""Validated graph structures for cause, dependency, and intervention chains."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Iterable


NODE_TYPES = {"event", "failure", "dependency", "impact", "intervention", "context"}
EDGE_RELATIONS = {
    "causes",
    "may_cause",
    "depends_on",
    "threatens",
    "mitigated_by",
    "contextualizes",
}


@dataclass(frozen=True)
class CascadeNode:
    """A graph node with evidence or an explicit hypothesis uncertainty."""

    id: str
    node_type: str
    label: str
    confidence: float
    evidence_ids: tuple[str, ...] = ()
    uncertainty: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.id.strip() or not self.label.strip():
            raise ValueError("cascade node id and label are required")
        if self.node_type not in NODE_TYPES:
            raise ValueError(f"unsupported cascade node type: {self.node_type}")
        if not 0 <= self.confidence <= 1:
            raise ValueError("cascade node confidence must be between 0 and 1")
        if not self.evidence_ids and not (self.uncertainty or "").strip():
            raise ValueError(
                "a node without evidence_ids must include an uncertainty statement"
            )


@dataclass(frozen=True)
class CascadeEdge:
    """A typed relationship between two graph nodes."""

    source_id: str
    target_id: str
    relation: str
    confidence: float
    rationale: str
    evidence_ids: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if not self.source_id or not self.target_id or self.source_id == self.target_id:
            raise ValueError("cascade edge must connect two different nodes")
        if self.relation not in EDGE_RELATIONS:
            raise ValueError(f"unsupported cascade relation: {self.relation}")
        if not 0 <= self.confidence <= 1:
            raise ValueError("cascade edge confidence must be between 0 and 1")
        if not self.rationale.strip():
            raise ValueError("cascade edge rationale is required")


@dataclass
class CascadeGraph:
    """A validated, serializable cascade graph."""

    nodes: list[CascadeNode] = field(default_factory=list)
    edges: list[CascadeEdge] = field(default_factory=list)

    def add_node(self, node: CascadeNode) -> None:
        if any(existing.id == node.id for existing in self.nodes):
            raise ValueError(f"duplicate cascade node id: {node.id}")
        self.nodes.append(node)

    def add_edge(self, edge: CascadeEdge) -> None:
        node_ids = {node.id for node in self.nodes}
        if edge.source_id not in node_ids or edge.target_id not in node_ids:
            raise ValueError("cascade edge references an unknown node")
        self.edges.append(edge)

    def to_dict(self) -> dict[str, Any]:
        return {
            "nodes": [asdict(node) for node in self.nodes],
            "edges": [asdict(edge) for edge in self.edges],
        }

    @classmethod
    def from_dict(
        cls,
        value: Any,
        *,
        allowed_evidence_ids: Iterable[str] = (),
    ) -> "CascadeGraph":
        if not isinstance(value, dict):
            raise ValueError("cascade_graph must be an object")
        raw_nodes = value.get("nodes")
        raw_edges = value.get("edges")
        if not isinstance(raw_nodes, list) or not isinstance(raw_edges, list):
            raise ValueError("cascade_graph needs nodes and edges arrays")
        if not raw_nodes:
            raise ValueError("cascade_graph needs at least one node")

        allowed_ids = set(allowed_evidence_ids)
        graph = cls()
        for raw in raw_nodes:
            if not isinstance(raw, dict):
                raise ValueError("each cascade node must be an object")
            node = CascadeNode(
                id=str(raw.get("id", "")),
                node_type=str(raw.get("node_type", raw.get("type", ""))),
                label=str(raw.get("label", "")),
                confidence=float(raw.get("confidence", 0)),
                evidence_ids=tuple(str(item) for item in raw.get("evidence_ids", [])),
                uncertainty=raw.get("uncertainty"),
                metadata=raw.get("metadata", {}),
            )
            if allowed_ids and any(
                evidence_id not in allowed_ids for evidence_id in node.evidence_ids
            ):
                raise ValueError(f"node {node.id} cites unknown evidence")
            graph.add_node(node)

        for raw in raw_edges:
            if not isinstance(raw, dict):
                raise ValueError("each cascade edge must be an object")
            edge = CascadeEdge(
                source_id=str(raw.get("source_id", raw.get("from", ""))),
                target_id=str(raw.get("target_id", raw.get("to", ""))),
                relation=str(raw.get("relation", "")),
                confidence=float(raw.get("confidence", 0)),
                rationale=str(raw.get("rationale", "")),
                evidence_ids=tuple(str(item) for item in raw.get("evidence_ids", [])),
            )
            if allowed_ids and any(
                evidence_id not in allowed_ids for evidence_id in edge.evidence_ids
            ):
                raise ValueError("edge cites unknown evidence")
            graph.add_edge(edge)
        return graph