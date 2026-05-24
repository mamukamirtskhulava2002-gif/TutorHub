import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function StudentDashboard() {
  return (
    <div>
      <Navbar />
      <div className="dash-container">
        {/* საიდბარი */}
        <div className="sidebar">
          <Link href="/dashboard/student" className="sidebar-link active">📊 დაშბორდი</Link>
          <Link href="/messages" className="sidebar-link">✉️ შეტყობინებები</Link>
          <Link href="/favorites" className="sidebar-link">❤️ ფავორიტები</Link>
        </div>

        {/* მთავარი კონტენტი */}
        <div className="main-content">
          <h1 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "24px" }}>გამარჯობა, მამუკა! 🎓</h1>
          
          <div className="stats-grid">
            <div className="stat-card"><h3>12</h3><p style={{ color: "var(--text-muted)" }}>ჩატარებული გაკვეთილი</p></div>
            <div className="stat-card"><h3>2</h3><p style={{ color: "var(--text-muted)" }}>აქტიური რეპეტიტორი</p></div>
            <div className="stat-card"><h3>60 ₾</h3><p style={{ color: "var(--text-muted)" }}>მიმდინარე თვის ბალანსი</p></div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>📅 შემდეგი გაკვეთილი</h3>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h4>მათემატიკა — ნიკოლოზ ხუციშვილი</h4>
                <p style={{ color: "var(--text-muted)", marginTop: "4px" }}>ხუთშაბათი, 28 მაისი · 18:00 (ონლაინ)</p>
              </div>
              <span className="badge badge-green">დადასტურებული</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}