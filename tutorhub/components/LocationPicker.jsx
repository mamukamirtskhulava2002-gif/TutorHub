"use client";
import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function makePinIcon() {
  return L.divIcon({
    html: `<div style="
      background:#059669;border:3px solid white;border-radius:50%;
      width:32px;height:32px;display:flex;align-items:center;
      justify-content:center;font-size:18px;
      box-shadow:0 3px 12px rgba(5,150,105,0.45);cursor:grab;
    ">📍</div>`,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
}

function ClickHandler({ onPick }) {
  useMapEvents({ click: e => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function FlyTo({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.setView([lat, lng], Math.max(map.getZoom(), 13));
  }, [lat, lng, map]);
  return null;
}

export default function LocationPicker({ value, onChange, height = "300px" }) {
  const [mounted, setMounted] = useState(false);
  const [map, setMap] = useState(null);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <div style={{ height, borderRadius: "12px", background: "#f3f4f6" }}
        className="flex items-center justify-center text-sm text-gray-400">
        იტვირთება რუკა...
      </div>
    );
  }

  const center = value ? [value.lat, value.lng] : [42.0, 43.5];
  const zoom   = value ? 13 : 7;

  return (
    <div>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height, width: "100%", borderRadius: "12px", zIndex: 0 }}
        scrollWheelZoom={false}
        ref={setMap}
      >
        {map && (
          <>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickHandler onPick={onChange} />
            {value?.lat && value?.lng && (
              <>
                <Marker
                  position={[value.lat, value.lng]}
                  icon={makePinIcon()}
                  draggable
                  eventHandlers={{
                    dragend: e => {
                      const p = e.target.getLatLng();
                      onChange({ lat: p.lat, lng: p.lng });
                    },
                  }}
                />
                <FlyTo lat={value.lat} lng={value.lng} />
              </>
            )}
          </>
        )}
      </MapContainer>
      <p className="text-xs text-gray-400 mt-2">
        🖱️ რუკაზე ნებისმიერ ადგილს დააჭირეთ — მარკერი იქ დაიდება. შეგიძლიათ გადაიტანოთ.
      </p>
    </div>
  );
}
