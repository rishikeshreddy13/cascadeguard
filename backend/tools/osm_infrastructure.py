"""Look up nearby mapped infrastructure from the OpenStreetMap map API."""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from xml.etree import ElementTree

from backend.models import Evidence


OSM_MAP_URL = "https://api.openstreetmap.org/api/0.6/map"

INTERESTING_TAGS = {
    "amenity": {
        "college",
        "clinic",
        "fire_station",
        "hospital",
        "police",
        "school",
        "university",
    },
    "highway": {
        "bridge",
        "footway",
        "motorway",
        "path",
        "primary",
        "residential",
        "secondary",
        "service",
        "tertiary",
        "track",
        "trunk",
        "unclassified",
    },
    "man_made": {"water_tower", "water_works"},
    "power": {"plant", "substation"},
    "railway": {"station", "subway_entrance"},
    "waterway": {"canal", "river", "stream"},
}


class OSMError(RuntimeError):
    """Raised when OpenStreetMap cannot provide the requested context."""


def fetch_nearby_infrastructure(
    *,
    latitude: float,
    longitude: float,
    radius_km: float = 5,
    limit: int = 25,
    timeout_seconds: int = 30,
) -> dict[str, Any]:
    """Return nearby mapped infrastructure as evidence objects."""

    _validate_coordinates(latitude, longitude)
    if radius_km <= 0 or radius_km > 5:
        raise ValueError("radius_km must be greater than 0 and no more than 5")
    if limit < 1 or limit > 50:
        raise ValueError("limit must be between 1 and 50")

    latitude_delta = radius_km / 111.32
    longitude_delta = radius_km / (111.32 * max(math.cos(math.radians(latitude)), 0.1))
    bbox = (
        longitude - longitude_delta,
        latitude - latitude_delta,
        longitude + longitude_delta,
        latitude + latitude_delta,
    )
    query = urlencode({"bbox": ",".join(f"{value:.6f}" for value in bbox)})
    request = Request(
        f"{OSM_MAP_URL}?{query}",
        headers={
            "Accept": "application/xml",
            "User-Agent": "CascadeGuard/0.1 (disaster-research demo)",
        },
        method="GET",
    )
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            xml_body = response.read()
    except HTTPError as error:
        raise OSMError(f"OpenStreetMap returned HTTP {error.code}.") from error
    except URLError as error:
        raise OSMError(f"OpenStreetMap request failed: {error.reason}") from error

    try:
        root = ElementTree.fromstring(xml_body)
    except ElementTree.ParseError as error:
        raise OSMError("OpenStreetMap returned invalid XML.") from error

    nodes = {
        element.attrib["id"]: (
            float(element.attrib["lat"]),
            float(element.attrib["lon"]),
        )
        for element in root
        if element.tag == "node"
        and "id" in element.attrib
        and "lat" in element.attrib
        and "lon" in element.attrib
    }
    features: list[dict[str, Any]] = []

    for element in root:
        if element.tag not in {"node", "way"}:
            continue
        tags = _tags(element)
        category, kind = _interesting_tag(tags)
        if not category:
            continue

        center = _element_center(element, nodes)
        if center is None:
            continue
        distance = _distance_km(latitude, longitude, center[0], center[1])
        if distance > radius_km:
            continue

        osm_type = element.tag
        osm_id = element.attrib.get("id", "")
        features.append(
            Evidence(
                source="OpenStreetMap",
                source_url=f"https://www.openstreetmap.org/{osm_type}/{osm_id}",
                timestamp=element.attrib.get("timestamp") or _utc_now(),
                location={
                    "latitude": center[0],
                    "longitude": center[1],
                    "distance_km": round(distance, 3),
                },
                claim=(
                    f"OpenStreetMap maps a {kind.replace('_', ' ')}"
                    f"{_named_suffix(tags)} within {distance:.2f} km of the event."
                ),
                data_type="infrastructure_feature",
                source_tier="open_geographic_data",
                confidence=0.7,
                confidence_basis=(
                    "Mapped feature presence; operational status and current "
                    "condition are not verified."
                ),
                metadata={
                    "osm_type": osm_type,
                    "osm_id": osm_id,
                    "category": category,
                    "kind": kind,
                    "name": tags.get("name"),
                    "tags": {
                        key: tags[key]
                        for key in (
                            "amenity",
                            "highway",
                            "man_made",
                            "power",
                            "railway",
                            "waterway",
                        )
                        if key in tags
                    },
                },
            ).to_dict()
        )

    selected_features = _select_diverse(features, limit)
    return {
        "tool": "nearby_infrastructure",
        "source": OSM_MAP_URL,
        "retrieved_at": _utc_now(),
        "query": {
            "latitude": latitude,
            "longitude": longitude,
            "radius_km": radius_km,
            "limit": limit,
            "bbox": bbox,
        },
        "evidence": selected_features,
        "count": len(selected_features),
    }


def _tags(element: ElementTree.Element) -> dict[str, str]:
    return {
        tag.attrib["k"]: tag.attrib.get("v", "")
        for tag in element
        if tag.tag == "tag" and "k" in tag.attrib
    }


def _interesting_tag(tags: dict[str, str]) -> tuple[str | None, str | None]:
    for category, values in INTERESTING_TAGS.items():
        if tags.get(category) in values:
            return category, tags[category]
    return None, None


def _element_center(
    element: ElementTree.Element, nodes: dict[str, tuple[float, float]]
) -> tuple[float, float] | None:
    if element.tag == "node":
        try:
            return float(element.attrib["lat"]), float(element.attrib["lon"])
        except (KeyError, ValueError):
            return None

    points = [
        nodes[nd.attrib["ref"]]
        for nd in element
        if nd.tag == "nd" and nd.attrib.get("ref") in nodes
    ]
    if not points:
        return None
    return (
        sum(point[0] for point in points) / len(points),
        sum(point[1] for point in points) / len(points),
    )


def _distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0
    lat_delta = math.radians(lat2 - lat1)
    lon_delta = math.radians(lon2 - lon1)
    haversine = (
        math.sin(lat_delta / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(lon_delta / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(haversine))


def _named_suffix(tags: dict[str, str]) -> str:
    return f" named “{tags['name']}”" if tags.get("name") else ""


def _select_diverse(
    features: list[dict[str, Any]], limit: int
) -> list[dict[str, Any]]:
    """Prefer nearby features without letting one repeated kind dominate."""

    features.sort(key=lambda feature: feature["location"]["distance_km"])
    selected: list[dict[str, Any]] = []
    category_counts: dict[str, int] = {}
    category_caps = {
        "waterway": 5,
        "highway": 10,
        "amenity": 10,
        "railway": 8,
        "power": 8,
        "man_made": 8,
    }
    for feature in features:
        category = feature["metadata"]["category"]
        if category_counts.get(category, 0) >= category_caps.get(category, 5):
            continue
        selected.append(feature)
        category_counts[category] = category_counts.get(category, 0) + 1
        if len(selected) >= limit:
            break
    return selected


def _validate_coordinates(latitude: float, longitude: float) -> None:
    if not -90 <= latitude <= 90:
        raise ValueError("latitude must be between -90 and 90")
    if not -180 <= longitude <= 180:
        raise ValueError("longitude must be between -180 and 180")


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")