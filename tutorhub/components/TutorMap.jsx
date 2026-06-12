"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getRegionById } from "@/lib/geo-data";

// Fix leaflet default marker icon missing in webpack/Next.js
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const SUBJECT_ICONS = {
  "მათემატიკა":"📐","ფიზიკა":"⚛️","ქიმია":"🧪","ბიოლოგია":"🌿",
  "ქართული":"📖","ინგლისური":"🇬🇧","ისტორია":"🏛️","პროგრამირება":"💻",
  "გეოგრაფია":"🌍","ეკონომიკა":"📈","გერმანული":"🇩🇪","რუსული":"🇷🇺",
};

function makeIcon(subjects) {
  const emoji = SUBJECT_ICONS[subjects?.[0]] || "👨‍🏫";
  const html = `
    <div style="
      background:white;border:2px solid #059669;border-radius:50%;
      width:38px;height:38px;display:flex;align-items:center;
      justify-content:center;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.2);
      cursor:pointer;
    ">${emoji}</div>`;
  return L.divIcon({ html, className: "", iconSize: [38, 38], iconAnchor: [19, 19] });
}

// Georgian star icon for single-tutor view
function makeSingleIcon() {
  const html = `
    <div style="
      background:#059669;border:2px solid white;border-radius:50%;
      width:44px;height:44px;display:flex;align-items:center;
      justify-content:center;font-size:22px;box-shadow:0 3px 12px rgba(5,150,105,0.4);
    ">📍</div>`;
  return L.divIcon({ html, className: "", iconSize: [44, 44], iconAnchor: [22, 44] });
}

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function FitBounds({ tutors, focusRegion }) {
  const map = useMap();
  useEffect(() => {
    // If a specific region is selected, zoom to it
    if (focusRegion) {
      const region = getRegionById(focusRegion);
      if (region?.lat && region?.lng) {
        map.setView([region.lat, region.lng], 9);
        return;
      }
    }
    if (!tutors || tutors.length === 0) return;
    if (tutors.length === 1) {
      map.setView([tutors[0].lat, tutors[0].lng], 12);
      return;
    }
    const bounds = L.latLngBounds(tutors.map(t => [t.lat, t.lng]));
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [tutors, focusRegion, map]);
  return null;
}

// tutors: array of { id, lat, lng, name, subject, price_per_hour, rating, review_count, is_verified, city }
// singleMode: boolean — only one tutor, no popup link
// focusRegion: string region id to zoom to
export default function TutorMap({ tutors = [], singleMode = false, height = "500px", focusRegion = null }) {
  const validTutors = tutors.filter(t => t.lat && t.lng);

  // Georgia center
  const center = [42.0, 43.5];
  const zoom   = 7;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height, width: "100%", borderRadius: "16px", zIndex: 0 }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {validTutors.map((t, i) => (
        <Marker
          key={t.id ?? i}
          position={[t.lat, t.lng]}
          icon={singleMode ? makeSingleIcon() : makeIcon(t.subject)}
        >
          {!singleMode && (
            <Popup minWidth={200}>
              <div style={{ fontFamily: "sans-serif", padding: "2px 0" }}>
                {/* Avatar + name */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: "#d1fae5", color: "#065f46",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 14, flexShrink: 0,
                  }}>
                    {t.avatar_url
                      ? <img src={t.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                      : getInitials(t.name)
                    }
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14, margin: 0, lineHeight: 1.3 }}>{t.name}</p>
                    <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
                      {(t.subject || []).join(", ")}
                    </p>
                  </div>
                </div>

                {/* Stats row */}
                <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  {t.rating > 0 && (
                    <span style={{ fontSize: 12, color: "#92400e", background: "#fef3c7", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>
                      ⭐ {t.rating?.toFixed(1)}
                    </span>
                  )}
                  {t.price_per_hour > 0 && (
                    <span style={{ fontSize: 12, color: "#065f46", background: "#d1fae5", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>
                      {t.price_per_hour} ₾/სთ
                    </span>
                  )}
                  {t.is_verified && (
                    <span style={{ fontSize: 12, color: "#92400e", background: "#fef3c7", padding: "2px 8px", borderRadius: 20 }}>
                      ✓ ვერ.
                    </span>
                  )}
                </div>

                {t.city && (
                  <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>📍 {t.city}</p>
                )}

                <a
                  href={`/tutor/${t.id}`}
                  style={{
                    display: "block", textAlign: "center",
                    background: "#059669", color: "white",
                    borderRadius: 8, padding: "6px 0",
                    textDecoration: "none", fontWeight: 700, fontSize: 13,
                  }}
                >
                  პროფილის ნახვა →
                </a>
              </div>
            </Popup>
          )}
          {singleMode && (
            <Popup>
              <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>{t.name}</p>
              {t.city && <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>📍 {t.city}</p>}
            </Popup>
          )}
        </Marker>
      ))}

      {(validTutors.length > 0 || focusRegion) && <FitBounds tutors={validTutors} focusRegion={focusRegion} />}

      {!singleMode && validTutors.length === 0 && tutors.length > 0 && (
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          background: "rgba(255,255,255,0.75)", zIndex: 999, borderRadius: 16,
          pointerEvents: "none",
        }}>
          <p style={{ color: "#6b7280", fontWeight: 600, fontSize: 13 }}>📍 მდებარეობა მითითებული არ არის</p>
        </div>
      )}
    </MapContainer>
  );
}
