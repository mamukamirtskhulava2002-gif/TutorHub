import Navbar from "@/components/Navbar";

export default function AuthPage() {
  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: "400px", margin: "80px auto", padding: "32px", background: "white", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)" }}>
        <h2 style={{ fontSize: "24px", fontWeight: "700", marginBottom: "24px", textAlign: "center" }}>სისტემაში შესვლა</h2>
        <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
          <button className="nav-btn btn-green" style={{ flex: 1 }}>სტუდენტი</button>
          <button className="nav-btn btn-outline" style={{ flex: 1 }}>მასწავლებელი</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <input type="email" placeholder="ელ-ფოსტა" style={{ width: "100%", padding: "12px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }} />
          <input type="password" placeholder="პაროლი" style={{ width: "100%", padding: "12px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }} />
          <button className="nav-btn btn-green" style={{ width: "100%", padding: "12px" }}>შესვლა</button>
        </div>
      </div>
    </div>
  );
}