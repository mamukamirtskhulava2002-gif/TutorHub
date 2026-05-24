import Navbar from "@/components/Navbar";

export default function DashboardPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar />
      <div style={{ maxWidth: "1200px", margin: "40px auto", width: "100%", padding: "0 24px" }}>
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: "700" }}>გამარჯობა, ნიკოლოზ!</h1>
          <p style={{ color: "var(--text-muted)" }}>კეთილი იყოს თქვენი მობრძანება მართვის პანელში.</p>
        </div>
        
        {/* პანელის სტატისტიკა */}
        <div style={{ background: "var(--white)", padding: "32px", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)" }}>
          <h3 style={{ fontWeight: "600", marginBottom: "12px" }}>თქვენი ბალანსი</h3>
          <div style={{ fontSize: "36px", fontWeight: "700", color: "var(--green)" }}>1,240 ₾</div>
        </div>
      </div>
    </div>
  );
}