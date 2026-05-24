import Navbar from "@/components/Navbar";

export default function ParentDashboard() {
  return (
    <div>
      <Navbar />
      <div className="dash-container">
        <div className="sidebar">
          <div className="sidebar-link active">👦 ბავშვების პროგრესი</div>
          <div className="sidebar-link">💳 გადახდები</div>
        </div>

        <div className="main-content">
          <h1 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "24px" }}>მშობლის კონტროლის პანელი 👨‍👩‍👧</h1>
          
          <div className="card">
            <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px" }}>ლუკა ხუციშვილი (მე-9 კლასი)</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              <div style={{ background: "var(--bg)", padding: "16px", borderRadius: "var(--radius)" }}>
                <strong>📚 საგანი: მათემატიკა</strong>
                <p style={{ marginTop: "8px" }}>დასწრება: 100% · დასრულებული: 8 გაკვეთილი</p>
                <div style={{ marginTop: "8px", fontWeight: "600", color: "var(--green)" }}>რეპეტიტორის კომენტარი: პროგრესი აშკარაა!</div>
              </div>
              <div style={{ background: "var(--bg)", padding: "16px", borderRadius: "var(--radius)" }}>
                <strong>🇬🇧 საგანი: ინგლისური</strong>
                <p style={{ marginTop: "8px" }}>დასწრება: 90% · მომდევნო გაკვეთილი: ხვალ</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}