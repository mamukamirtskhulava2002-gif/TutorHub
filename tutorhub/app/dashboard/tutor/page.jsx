import Navbar from "@/components/Navbar";

export default function TutorDashboard() {
  return (
    <div>
      <Navbar />
      <div className="dash-container">
        <div className="sidebar">
          <div className="sidebar-link active">👨‍🏫 პანელი</div>
          <div className="sidebar-link">📅 განრიგი</div>
          <div className="sidebar-link">💰 ფინანსები</div>
        </div>

        <div className="main-content">
          <h1 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "24px" }}>მასწავლებლის კაბინეტი </h1>
          
          <div className="stats-grid">
            <div className="stat-card"><h3 style={{ color: "var(--green)" }}>1,240 ₾</h3><p style={{ color: "var(--text-muted)" }}>ამ თვის შემოსავალი</p></div>
            <div className="stat-card"><h3>24</h3><p style={{ color: "var(--text-muted)" }}>აქტიური სტუდენტი</p></div>
            <div className="stat-card"><h3 style={{ color: "var(--amber)" }}>⭐ 4.9</h3><p style={{ color: "var(--text-muted)" }}>საერთო რეიტინგი</p></div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>📝 ბოლო გამოხმაურებები</h3>
            <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "12px", marginBottom: "12px" }}>
              <strong>გიორგი ლომიძე:</strong> <span style={{ color: "var(--amber)" }}>⭐⭐⭐⭐⭐</span>
              <p style={{ color: "var(--text-muted)", marginTop: "4px" }}>ძალიან გასაგებად ხსნის მასალას, შედეგი პირველივე თვეში დავინახეთ!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}