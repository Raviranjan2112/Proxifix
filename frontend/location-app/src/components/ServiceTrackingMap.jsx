import { useEffect } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

function FitTrackingBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 1) {
      map.setView(points[0], 16, { animate: true });
      return;
    }

    if (points.length > 1) {
      map.fitBounds(points, { padding: [34, 34], maxZoom: 15, animate: true });
    }
  }, [map, points]);

  return null;
}

function validPoint(location) {
  if (
    location?.latitude === null
    || location?.latitude === undefined
    || location?.longitude === null
    || location?.longitude === undefined
  ) {
    return null;
  }

  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);

  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? [latitude, longitude]
    : null;
}

export default function ServiceTrackingMap({ customerLocation, workerLocation, className = "" }) {
  const customerPoint = validPoint(customerLocation);
  const workerPoint = validPoint(workerLocation);
  const points = [customerPoint, workerPoint].filter(Boolean);

  if (!customerPoint) {
    return <p className="map-unavailable">The customer location is unavailable for this booking.</p>;
  }

  return (
    <div className={`tracking-map ${className}`.trim()}>
      <MapContainer center={workerPoint || customerPoint} zoom={15} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitTrackingBounds points={points} />
        <Circle center={customerPoint} radius={100} pathOptions={{ color: "#08713d", fillColor: "#8ed6a4", fillOpacity: 0.22 }} />
        <CircleMarker center={customerPoint} radius={9} pathOptions={{ color: "#075c31", fillColor: "#ffffff", fillOpacity: 1, weight: 4 }}>
          <Tooltip direction="top" offset={[0, -8]} permanent>Customer address</Tooltip>
        </CircleMarker>
        {workerPoint && (
          <>
            <CircleMarker center={workerPoint} radius={10} pathOptions={{ color: "#b45f06", fillColor: "#ffb74d", fillOpacity: 1, weight: 3 }}>
              <Tooltip direction="top" offset={[0, -8]} permanent>Worker location</Tooltip>
            </CircleMarker>
            <Polyline positions={[workerPoint, customerPoint]} pathOptions={{ color: "#075c31", dashArray: "8 10", weight: 3 }} />
          </>
        )}
      </MapContainer>
      <p className="map-key"><span className="map-key-worker" /> Worker <span className="map-key-customer" /> Customer · green circle = 100 m arrival zone</p>
    </div>
  );
}
