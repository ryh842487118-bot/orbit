# Public API samples

These small, unmodified record subsets were retrieved on 2026-09-06 from the public APIs below. They are deterministic parser test fixtures, never runtime fallbacks. Collection metadata may describe the original full response rather than the subset saved here.

- `weather.json`: Open-Meteo current weather for Shanghai and London, https://api.open-meteo.com/v1/forecast
- `usgs.json`: three features from https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson
- `eonet-*.json`: up to two events per category from https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=CATEGORY&limit=100
- `gdacs.json`: one tropical cyclone centroid and three separate track segments from https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventtype=TC
- `gdacs-flood.json`: one flood centroid from https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventtype=FL

An empty EONET flood collection is the actual source response. GDACS provides separate flood observations; the empty NASA collection must not be treated as a network failure.

Cyclone advisory fixtures were retrieved on 2026-09-06. Large unused image URLs,
wind-radius polygons and population fields were omitted; retained values are unchanged:

- `gdacs-noaa-detail.json`: MARIE-26, GDACS event 1001317 / episode 18, https://www.gdacs.org/gdacsapi/api/events/getepisodedata?eventtype=TC&eventid=1001317&episodeid=18
- `gdacs-noaa-timeline.json`: the above response's published timeline, https://www.gdacs.org/gdacsapi/api/export/gettimeline?id=793141
- `gdacs-jtwc-detail.json`: KROVANH-26, GDACS event 1001318 / episode 18, https://www.gdacs.org/gdacsapi/api/events/getepisodedata?eventtype=TC&eventid=1001318&episodeid=18
- `gdacs-jtwc-timeline.json`: the above response's published timeline, https://www.gdacs.org/gdacsapi/api/export/gettimeline?id=793134

Both episode and timeline endpoints returned HTTP 200 with `Access-Control-Allow-Origin: *`.
Timeline `actual` explicitly distinguishes observed and forecast positions; `current`
identifies the current observed advisory. `advisory_datetime` is each point's UTC
validity time. The timeline wind values are m/s: multiplying MARIE's values by 3.6
and rounding gives the exact km/h series published in GDACS's official
[bulletin timeline](https://www.gdacs.org/Cyclones/report.aspx?eventid=1001317&episodeid=18&eventtype=TC).
For example, `41.152` m/s at 05 Sep 2026 15:00 is displayed there as `148` km/h.
GDACS list `severitydata.severity` is the event maximum; EONET `magnitudeValue`
with `magnitudeUnit: "kts"` is converted using 1 kt = 1.852 km/h.
