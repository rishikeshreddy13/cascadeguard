"""A small, bounded reasoning loop for CascadeGuard."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from backend.decision import RankedIntervention, rank_interventions
from backend.featherless_client import chat_completion
from backend.models import CascadeGraph
from backend.tools import (
    fetch_event_context,
    fetch_nearby_infrastructure,
    fetch_nepal_replay,
)


AGENT_INSTRUCTIONS = """\
You are the investigation planner for CascadeGuard.

Your job is to decide what the system needs to learn next about a crisis.
Use the controlled tools when their evidence would reduce uncertainty. Never
claim that a mapped facility is operating or that infrastructure is damaged.

Return JSON only, with this shape:
{
  "action": "call_tool" or "final",
  "tool": "gdacs_event_context", "nearby_infrastructure", "nepal_flood_replay" or "",
  "tool_input": {"country": "...", "event_type": "FL", "limit": 5}
    or {"latitude": 27.3, "longitude": 85.36, "radius_km": 5, "limit": 25},
  "what_i_know": ["short statements grounded only in the request"],
  "what_i_need_next": "one specific missing fact, or an empty string",
  "reason": "why that fact matters to cascade analysis",
  "cascade_graph": {
    "nodes": [
      {
        "id": "short_id",
        "node_type": "event|failure|dependency|impact|intervention|context",
        "label": "short label",
        "confidence": 0.0,
        "evidence_ids": ["exact evidence_id from tool output"],
        "uncertainty": "required when evidence_ids is empty"
      }
    ],
    "edges": [
      {
        "source_id": "short_id",
        "target_id": "short_id",
        "relation": "causes|may_cause|depends_on|threatens|mitigated_by|contextualizes",
        "confidence": 0.0,
        "rationale": "why this relationship is supported or uncertain",
        "evidence_ids": []
      }
    ]
  },
  "interventions": [
    {
      "node_id": "intervention_node_id",
      "action": "a human-verifiable action to consider",
      "feasibility": 0.0
    }
  ]
}

Use "call_tool" when event facts or nearby mapped infrastructure are missing
and one of the tools can help. For the deterministic Nepal demo, prefer
nepal_flood_replay before live tools so the evidence path is reproducible.
Only use the exact tool names shown above.
Use "final" only when you can give a clearly labelled provisional conclusion
from the request and tool evidence. A provisional conclusion is not a
verified disaster assessment. When final, include a cascade_graph. Use exact
evidence_id values from tool output; never invent them. A hypothesis node or
edge without evidence must carry explicit uncertainty in its uncertainty or
rationale field and use a low confidence. Include intervention candidates only
as decision-support recommendations; never claim that an action was executed.
Every intervention candidate node_id must point to a graph node whose
node_type is exactly "intervention"; never use an event, failure, dependency,
impact, or context node as an intervention.
If you want to recommend an action such as "pre-position supplies", first add
a node like {"id":"preposition_supplies","node_type":"intervention",...} and
then reference "preposition_supplies" in interventions. If no such node exists,
return an empty interventions array instead of guessing an ID.
"""


@dataclass(frozen=True)
class AgentStep:
    """One model decision in an agent run."""

    number: int
    raw_response: str
    decision: dict[str, Any]
    tool_result: dict[str, Any] | None = None


@dataclass
class AgentRun:
    """The complete result of a bounded investigation-planning run."""

    goal: str
    steps: list[AgentStep] = field(default_factory=list)
    final_response: str = ""
    stopped_reason: str = ""
    cascade_graph: CascadeGraph | None = None
    graph_error: str | None = None
    ranked_interventions: list[RankedIntervention] = field(default_factory=list)
    intervention_error: str | None = None


class BoundedAgent:
    """Run a Featherless-backed planning loop with a hard step limit."""

    def __init__(self, *, max_steps: int = 3, model: str | None = None) -> None:
        if max_steps < 1:
            raise ValueError("max_steps must be at least 1")
        self.max_steps = max_steps
        self.model = model

    def run(self, goal: str) -> AgentRun:
        """Ask the model for the next investigation decision until it stops."""

        clean_goal = goal.strip()
        if not clean_goal:
            raise ValueError("goal must not be empty")

        messages: list[dict[str, str]] = [
            {"role": "system", "content": AGENT_INSTRUCTIONS},
            {
                "role": "user",
                "content": (
                    "Investigation goal:\n"
                    f"{clean_goal}\n\n"
                    "Start by identifying what is known and the single most "
                    "important missing fact."
                ),
            },
        ]
        run = AgentRun(goal=clean_goal)

        for number in range(1, self.max_steps + 1):
            response = chat_completion(
                messages,
                model=self.model,
                max_tokens=700,
                temperature=0.0,
            )
            raw_response = self._message_text(response)
            decision = self._parse_decision(raw_response)
            tool_result: dict[str, Any] | None = None

            messages.append({"role": "assistant", "content": raw_response})
            if decision["action"] == "final":
                run.steps.append(
                    AgentStep(
                        number=number,
                        raw_response=raw_response,
                        decision=decision,
                    )
                )
                self._attach_graph(run, decision)
                if number < self.max_steps and run.cascade_graph is None:
                    messages.append(
                        {
                            "role": "user",
                            "content": (
                                "Your final decision is missing a valid "
                                "cascade_graph. Return action=final again with "
                                "at least one valid node. Use exact evidence_id "
                                "values from tool results, and add explicit "
                                "uncertainty for unsupported hypotheses."
                            ),
                        }
                    )
                    continue
                run.final_response = raw_response
                run.stopped_reason = "model_finished"
                return run

            if decision["action"] == "call_tool":
                tool_result = self._call_tool(decision)
                messages.append(
                    {
                        "role": "user",
                        "content": (
                            "Tool result. Treat this as evidence, not certainty:\n"
                            f"{json.dumps(tool_result, ensure_ascii=False)}\n\n"
                            "Reassess the goal. Call the tool again only if "
                            "the evidence is insufficient; otherwise finish."
                        ),
                    }
                )
            else:
                messages.append(
                    {
                        "role": "user",
                        "content": (
                            "Your action was invalid. Return action=final and "
                            "explain that the result is provisional."
                        ),
                    }
                )

            run.steps.append(
                AgentStep(
                    number=number,
                    raw_response=raw_response,
                    decision=decision,
                    tool_result=tool_result,
                )
            )

            if number < self.max_steps and decision["action"] != "call_tool":
                messages.append(
                    {
                        "role": "user",
                        "content": (
                            "Continue the investigation plan. Re-evaluate the "
                            "known facts and name only one next missing fact."
                        ),
                    }
                )

        run.final_response = run.steps[-1].raw_response
        run.stopped_reason = "max_steps"
        self._attach_graph(run, self._parse_decision(run.final_response))
        return run

    @staticmethod
    def _attach_graph(run: AgentRun, decision: dict[str, Any]) -> None:
        run.cascade_graph = None
        run.graph_error = None
        run.ranked_interventions = []
        run.intervention_error = None
        raw_graph = decision.get("cascade_graph")
        if raw_graph is None:
            return
        evidence_ids = {
            evidence.get("evidence_id")
            for step in run.steps
            for evidence in (step.tool_result or {}).get("evidence", [])
            if isinstance(evidence, dict) and evidence.get("evidence_id")
        }
        try:
            run.cascade_graph = CascadeGraph.from_dict(
                raw_graph,
                allowed_evidence_ids=evidence_ids,
            )
        except (TypeError, ValueError) as error:
            run.graph_error = str(error)
            return

        try:
            run.ranked_interventions = rank_interventions(
                run.cascade_graph,
                decision.get("interventions"),
            )
        except (TypeError, ValueError) as error:
            run.intervention_error = str(error)

    @staticmethod
    def _call_tool(decision: dict[str, Any]) -> dict[str, Any]:
        tool_name = decision.get("tool")
        if tool_name not in {"gdacs_event_context", "nearby_infrastructure", "nepal_flood_replay"}:
            return {
                "tool": tool_name or "",
                "error": (
                    "Unknown tool. Available tools: gdacs_event_context, "
                    "nearby_infrastructure, and nepal_flood_replay."
                ),
                "evidence": [],
            }

        if tool_name == "nepal_flood_replay":
            try:
                return fetch_nepal_replay()
            except (TypeError, ValueError, RuntimeError) as error:
                return {"tool": tool_name, "error": str(error), "evidence": []}

        tool_input = decision.get("tool_input")
        if not isinstance(tool_input, dict):
            return {
                "tool": tool_name,
                "error": "tool_input must be a JSON object.",
                "evidence": [],
            }

        if tool_name == "gdacs_event_context":
            allowed = {"country", "event_type", "limit"}
        else:
            allowed = {"latitude", "longitude", "radius_km", "limit"}
        safe_input = {key: value for key, value in tool_input.items() if key in allowed}
        try:
            if tool_name == "gdacs_event_context":
                return fetch_event_context(**safe_input)
            return fetch_nearby_infrastructure(**safe_input)
        except (TypeError, ValueError, RuntimeError) as error:
            return {
                "tool": tool_name,
                "error": str(error),
                "evidence": [],
            }

    @staticmethod
    def _message_text(response: dict[str, Any]) -> str:
        try:
            content = response["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as error:
            raise RuntimeError("Featherless returned no assistant message.") from error
        if not isinstance(content, str) or not content.strip():
            raise RuntimeError("Featherless returned an empty assistant message.")
        return content.strip()

    @staticmethod
    def _parse_decision(raw_response: str) -> dict[str, Any]:
        """Parse model JSON and keep malformed output from breaking the loop."""

        candidate = raw_response.strip()
        if candidate.startswith("```"):
            candidate = candidate.strip("`")
            if candidate.startswith("json"):
                candidate = candidate[4:].lstrip()

        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            return {
                "action": "final",
                "what_i_know": [],
                "what_i_need_next": "",
                "reason": "The model response was not valid JSON.",
            }

        if not isinstance(parsed, dict):
            return {
                "action": "final",
                "what_i_know": [],
                "what_i_need_next": "",
                "reason": "The model response was not a JSON object.",
            }

        action = parsed.get("action")
        if action not in {"call_tool", "final"}:
            parsed["action"] = "final"
        return parsed