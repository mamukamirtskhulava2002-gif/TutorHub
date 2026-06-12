"use client";

import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useState } from "react";

const today = new Date().getDate();

const days = Array.from({ length: 7 }, (_, i) => today + i - 2).filter((d) => d >= 1 && d <= 31);

const tutor = {
  initials: "ნხ",
  name: "ნიკოლოზ ხუციშვილი",
  subject: "მათემატიკა",
  experience: "8 წლიანი გამოცდილება",
  rating: "4.9",
  reviews: 24,
  price: 30,
  bio: "მოგესალმებით! ვარ სერტიფიცირებული მათემატიკის რეპეტიტორი. ვამზადებ მოსწავლეებს როგორც ეროვნული გამოცდებისთვის, ასევე სასკოლო ოლიმპიადებისთვის.",
};

export default function ProfilePage() {
  const [selectedDate, setSelectedDate] = useState(today);

  return (
    <div>
      <Navbar />
      <div
        style={{
          maxWidth: "1200px",
          margin: "40px auto",
          padding: "0 24px",
          display: "grid",
          gridTemplateColumns: "1fr 380px",
          gap: "32px",
        }}
      >
        {/* მარცხენა მხარე */}
        <div>
          <div className="card" style={{ display: "flex", gap: "24px", alignItems: "center" }}>
            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                background: "var(--green-light)",
                color: "var(--green)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "28px",
                fontWeight: "700",
                flexShrink: 0,
              }}
            >
              {tutor.initials}
            </div>
            <div>
              <h1 style={{ fontSize: "24px", fontWeight: "700" }}>{tutor.name}</h1>
              <p style={{ color: "var(--text-muted)" }}>
                {tutor.subject} · {tutor.experience}
              </p>
              <div style={{ marginTop: "8px" }}>
                <span className="badge badge-green">
                  ⭐ {tutor.rating} ({tutor.reviews} შეფასება)
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "12px" }}>ჩემ შესახებ</h3>
            <p style={{ color: "var(--text-muted)", lineHeight: "1.7" }}>{tutor.bio}</p>
          </div>
        </div>

        {/* მარჯვენა მხარე */}
        <div className="card" style={{ height: "fit-content" }}>
          <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "4px" }}>
            {tutor.price} ₾{" "}
            <span style={{ fontSize: "14px", fontWeight: "400", color: "var(--text-muted)" }}>
              / საათი
            </span>
          </h3>
          <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--border)" }} />

          <h4 style={{ fontWeight: "600", marginBottom: "12px" }}>აირჩიეთ თარიღი:</h4>
          <div className="cal-grid">
            {days.map((day) => {
              const isPast = day < today;
              return (
                <div
                  key={day}
                  className={`cal-day${isPast ? " disabled" : ""}${selectedDate === day ? " active" : ""}`}
                  onClick={() => !isPast && setSelectedDate(day)}
                  style={{ cursor: isPast ? "not-allowed" : "pointer" }}
                >
                  {day}
                </div>
              );
            })}
          </div>

          <Link
            href={`/booking?date=${selectedDate}`}
            style={{ textDecoration: "none" }}
          >
            <button
              className="nav-btn btn-green"
              style={{ width: "100%", marginTop: "24px", padding: "12px" }}
            >
              გაკვეთილის დაჯავშნა ({selectedDate} რიცხვი)
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}