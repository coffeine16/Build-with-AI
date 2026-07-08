import "leaflet/dist/leaflet.css";
import { GeoJSON, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import wardBoundaries from "../data/wardBoundaries.json";
import wardHotspots from "../data/wardHotspots.json";

const JAIPUR_CENTER = [26.905, 75.79];

const hotspotByWard = Object.fromEntries(wardHotspots.map((w) => [w.ward_name, w]));

function colorForScore(score) {
  if (score >= 60) return "#a32626"; // rose — hotspot
  if (score >= 30) return "#a9760a"; // accent gold — elevated
  return "#0f6b3f"; // brand green — steady
}

function wardStyle(feature) {
  const ward = hotspotByWard[feature.properties.ward_name];
  const color = colorForScore(ward?.hotspot_score ?? 0);
  return {
    color,
    weight: ward?.is_hotspot ? 2.5 : 1.25,
    fillColor: color,
    fillOpacity: ward?.is_hotspot ? 0.45 : 0.25
  };
}

function bindWardTooltip(feature, layer) {
  const ward = hotspotByWard[feature.properties.ward_name];
  if (!ward) return;
  layer.bindTooltip(
    `<strong>${ward.ward_name}</strong><br/>` +
      `Hotspot score: ${ward.hotspot_score.toFixed(0)}/100${ward.is_hotspot ? " — flagged" : ""}<br/>` +
      `Avg DPS: ${ward.avg_dps} &middot; Top theme: ${ward.top_category}<br/>` +
      `Actual submissions: ${ward.n_submissions} (model expected ~${Math.max(0, Math.round(ward.predicted_submissions))})`,
    { sticky: true }
  );
}

export function WardHotspotMap() {
  return (
    <div className="ward-map-wrap">
      <div className="ward-map-shell">
        <MapContainer center={JAIPUR_CENTER} zoom={12} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <GeoJSON data={wardBoundaries} style={wardStyle} onEachFeature={bindWardTooltip} />
        </MapContainer>
      </div>
      <div className="ward-map-legend">
        <div className="ward-map-legend-row">
          <span className="ward-map-swatch" style={{ background: "#0f6b3f" }} />
          Steady
          <span className="ward-map-swatch" style={{ background: "#a9760a" }} />
          Elevated
          <span className="ward-map-swatch" style={{ background: "#a32626" }} />
          Hotspot
        </div>
        <p className="ward-map-note">
          Ward outlines are illustrative placeholders (not surveyed boundaries — see{" "}
          <code>data/README.md</code>). Hotspot score comes from a basic linear-regression
          model (<code>pipeline/hotspot_model.py</code>) comparing evidence-implied demand
          against actual citizen submissions per ward.
        </p>
      </div>
    </div>
  );
}
