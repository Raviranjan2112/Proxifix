import { useEffect, useState } from "react";
import {
  Circle,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  Marker,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "../context/ThemeContext.jsx";
import { Navigation, Clock, ShieldCheck, MapPin } from "lucide-react";

// Fix default Leaflet icon paths in bundler environments
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom pulsing worker vehicle marker (Swiggy / Zomato style)
const workerDivIcon = L.divIcon({
  className: "custom-tracking-marker",
  html: `
    <div class="tracking-marker-wrap">
      <span class="tracking-pulse"></span>
      <div class="tracking-marker-core worker-marker-core" title="Worker is en route">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
        </svg>
      </div>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

// Custom customer destination marker
const customerDivIcon = L.divIcon({
  className: "custom-tracking-marker",
  html: `
    <div class="tracking-marker-wrap">
      <div class="tracking-marker-core customer-marker-core" title="Customer address">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      </div>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

function FitTrackingBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 1) {
      map.setView(points[0], 15, { animate: true });
      return;
    }

    if (points.length > 1) {
      map.fitBounds(points, { padding: [40, 40], maxZoom: 16, animate: true });
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
  const { theme } = useTheme();
  const customerPoint = validPoint(customerLocation);
  const workerPoint = validPoint(workerLocation);
  const points = [customerPoint, workerPoint].filter(Boolean);

  const [roadPath, setRoadPath] = useState(null);
  const [etaInfo, setEtaInfo] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  // Fetch real road routing (turn-by-turn road curves like Swiggy/Zomato)
  useEffect(() => {
    if (!customerPoint || !workerPoint) {
      setRoadPath(null);
      setEtaInfo(null);
      return;
    }

    let isMounted = true;
    setLoadingRoute(true);

    const fetchRoute = async () => {
      try {
        // High-precision road driving navigation engine
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${workerPoint[1]},${workerPoint[0]};${customerPoint[1]},${customerPoint[0]}?overview=full&geometries=geojson`;
        const res = await fetch(osrmUrl);
        const data = await res.json();

        if (isMounted && data.code === "Ok" && data.routes?.[0]) {
          const route = data.routes[0];
          // GeoJSON returns [lng, lat]; Leaflet expects [lat, lng]
          const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          const distanceKm = (route.distance / 1000).toFixed(1);
          const durationMins = Math.max(1, Math.ceil(route.duration / 60));

          setRoadPath(coords);
          setEtaInfo({ distanceKm, durationMins });
        }
      } catch (err) {
        console.warn("Falling back to direct line:", err);
      } finally {
        if (isMounted) setLoadingRoute(false);
      }
    };

    fetchRoute();

    return () => {
      isMounted = false;
    };
  }, [customerPoint?.[0], customerPoint?.[1], workerPoint?.[0], workerPoint?.[1]]);

  if (!customerPoint) {
    return <p className="map-unavailable">The customer location is unavailable for this booking.</p>;
  }

  // Polished map tiles adapting to Light/Dark mode seamlessly
  const tileUrl = theme === "dark"
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  return (
    <div className={`tracking-map ${className}`.trim()}>
      {/* Swiggy/Zomato Live ETA Banner */}
      {workerPoint && (
        <div className="live-eta-banner">
          <div className="live-eta-badge">
            <span className="live-eta-dot" />
            <strong>{etaInfo ? `${etaInfo.durationMins} MINS AWAY` : "EN ROUTE"}</strong>
          </div>
          <div className="live-eta-stats">
            {etaInfo ? (
              <span>Distance: <strong>{etaInfo.distanceKm} km</strong></span>
            ) : (
              <span>Calculating road path...</span>
            )}
          </div>
        </div>
      )}

      <MapContainer center={workerPoint || customerPoint} zoom={15} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url={tileUrl}
        />
        <FitTrackingBounds points={points} />

        {/* 100m Customer Arrival Safe Zone */}
        <Circle
          center={customerPoint}
          radius={100}
          pathOptions={{
            color: "var(--primary)",
            fillColor: "var(--primary)",
            fillOpacity: 0.15,
            weight: 2,
            dashArray: "4 6",
          }}
        />

        {/* Customer Destination Marker */}
        <Marker position={customerPoint} icon={customerDivIcon}>
          <Tooltip direction="top" offset={[0, -10]} permanent>
            Customer Destination
          </Tooltip>
        </Marker>

        {/* Worker Moving Vehicle Marker & Road Route */}
        {workerPoint && (
          <>
            <Marker position={workerPoint} icon={workerDivIcon}>
              <Tooltip direction="top" offset={[0, -12]} permanent>
                {etaInfo ? `Worker (~${etaInfo.durationMins}m)` : "Worker"}
              </Tooltip>
            </Marker>

            {/* Road-snapped Polyline Curve */}
            <Polyline
              positions={roadPath || [workerPoint, customerPoint]}
              pathOptions={{
                color: theme === "dark" ? "#10b981" : "#059669",
                weight: 5,
                opacity: 0.9,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          </>
        )}
      </MapContainer>

      <p className="map-key">
        <span className="map-key-worker" /> Worker (Live)
        <span className="map-key-customer" style={{ marginLeft: 10 }} /> Customer
        <span style={{ marginLeft: "auto", opacity: 0.85, fontSize: "0.72rem" }}>
          Road-snapped live route • Green circle = 100m arrival zone
        </span>
      </p>
    </div>
  );
}
