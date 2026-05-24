import Navbar from "@/components/Navbar";

export default function AdminDashboard() {
  return (
    <div>
      <Navbar />
      <div className="dash-container">
        <div className="sidebar">
          <div className="sidebar-link active">🛠️ ვერიფიკაცია</div>
          <div className="sidebar-link">💳 ტრანზაქციები</div>
          <div className="sidebar-link">📈 ანალიტიკა</div>
        </div>

        <div className="main-content">
          <h1 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "24px" }}>ადმინისტრატორის პანელი ⚙️</h1>
          
          <div className="card">
            <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>⏳ მასწავლებლების ვერიფიკაციის მოთხოვნები (2)</h3>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "var(--bg)", borderRadius: "var(--radius)" }}>
              <div>
                <strong>ანა მესხი (ფიზიკის მასწავლებელი)</strong>
                <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>ატვირთულია: დიპლომი, სერტიფიკატი</p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="nav-btn btn-green" style={{ padding: "6px 12px", fontSize: "12px" }}>დადასტურება</button>
                <button className="nav-btn btn-outline" style={{ padding: "6px 12px", fontSize: "12px", color: "var(--red)", borderColor: "var(--red)" }}>უარყოფა</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}