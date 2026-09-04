"""Fetch current disaster event context from the public GDACS RSS feed."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from xml.etree import ElementTree

from backend.models import Evidence


GDACS_RSS_URL = "https://www.gdacs.org/XML/RSS.xml"


class GDACSError(RuntimeError):
    """Raised when the GDACS feed cannot be retrieved or parsed."""


def fetch_event_context(
    *,
    country: str | None = None,
    event_type: str | None = None,
    limit: int = 5,
    timeout_seconds: int = 20,
) -> dict[str, Any]:
    """Return normalized evidence for current GDACS events.

    The filters are applied locally after retrieving the public feed. This
    keeps the tool deterministic and avoids letting the model construct URLs.
    """

    if limit < 1 or limit > 20:
        raise ValueError("limit must be between 1 and 20")
    if event_type and (len(event_type) != 2 or not event_type.isalpha()):
        raise ValueError("event_type must be a two-letter GDACS code, such as FL")

    request = Request(
        GDACS_RSS_URL,
        headers={
            "Accept": "application/xml",
            "User-Agent": "CascadeGuard/0.1",
        },
        method="GET",
    )
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            xml_body = response.read()
    except HTTPError as error:
        raise GDACSError(f"GDACS returned HTTP {error.code}.") from error
    except URLError as error:
        raise GDACSError(f"GDACS request failed: {error.reason}") from error

    try:
        root = ElementTree.fromstring(xml_body)
    except ElementTree.ParseError as error:
        raise GDACSError("GDACS returned invalid XML.") from error

    normalized_country = country.strip().casefold() if country else None
    normalized_event_type = event_type.upper() if event_type else None
    evidence: list[dict[str, Any]] = []

    for item in root.iter():
        if _local_name(item.tag) != "item":
            continue

        event = _parse_item(item)
        if normalized_country and normalized_country not in event["country"].casefold():
            continue
        if normalized_event_type and event["event_type"] != normalized_event_type:
            continue
        evidence.append(_to_evidence(event))
        if len(evidence) >= limit:
            break

    return {
        "tool": "gdacs_event_context",
        "source": GDACS_RSS_URL,
        "retrieved_at": _utc_now(),
        "query": {
            "country": country,
            "event_type": normalized_event_type,
            "limit": limit,
        },
        "evidence": evidence,
        "count": len(evidence),
    }


def _parse_item(item: ElementTree.Element) -> dict[str, Any]:
    point = _text(item, "point").split()
    latitude = _as_float(point[0]) if len(point) == 2 else None
    longitude = _as_float(point[1]) if len(point) == 2 else None
    population = _find_attribute(item, "population", "value")

    return {
        "title": _text(item, "title"),
        "description": _text(item, "description"),
        "link": _text(item, "link"),
        "published_at": _text(item, "pubDate"),
        "country": _text(item, "country"),
        "iso3": _text(item, "iso3"),
        "event_type": _text(item, "eventtype"),
        "event_id": _text(item, "eventid"),
        "glide": _text(item, "glide"),
        "alert_level": _text(item, "alertlevel"),
        "alert_score": _as_float(_text(item, "alertscore")),
        "is_current": _text(item, "iscurrent").casefold() == "true",
        "latitude": latitude,
        "longitude": longitude,
        "affected_population": population,
    }


def _to_evidence(event: dict[str, Any]) -> dict[str, Any]:
    """Convert a GDACS record into the shared evidence shape."""

    return Evidence(
        source="GDACS RSS / European Commission Joint Research Centre",
        source_url=event["link"],
        timestamp=event["published_at"],
        location={
            "country": event["country"],
            "iso3": event["iso3"],
            "latitude": event["latitude"],
            "longitude": event["longitude"],
        },
        claim=event["description"],
        data_type="disaster_event",
        source_tier="international_monitoring",
        confidence=0.9,
        confidence_basis="Current public GDACS event feed; not field verification.",
        metadata={
            "title": event["title"],
            "event_type": event["event_type"],
            "event_id": event["event_id"],
            "glide": event["glide"],
            "alert_level": event["alert_level"],
            "alert_score": event["alert_score"],
            "is_current": event["is_current"],
            "affected_population": event["affected_population"],
        },
    ).to_dict()


def _text(parent: ElementTree.Element, wanted_name: str) -> str:
    for child in parent:
        if _local_name(child.tag) == wanted_name:
            return (child.text or "").strip()
    return ""


def _find_attribute(
    parent: ElementTree.Element, wanted_name: str, attribute: str
) -> str | None:
    for child in parent:
        if _local_name(child.tag) == wanted_name:
            return child.attrib.get(attribute)
    return None


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _as_float(value: str | None) -> float | None:
    try:
        return float(value) if value else None
    except ValueError:
        return None


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")