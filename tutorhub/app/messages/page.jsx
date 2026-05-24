import Navbar from "@/components/Navbar";

export default function MessagesPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar />
      <div style={{ maxWidth: "1200px", margin: "40px auto", width: "100%", padding: "0 24px", flex: 1, display: "flex" }}>
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", width: "100%", minHeight: "500px", display: "grid", gridTemplateColumns: "300px 1fr" }}>
          
          {/* ჩათების სია მარცხნივ */}
          <div style={{ borderRight: "1px solid var(--border)", padding: "16px" }}>
            <h3 style={{ fontWeight: "600", marginBottom: "16px" }}>შეტყობინებები</h3>
            <div style={{ padding: "12px", background: "var(--bg)", borderRadius: "var(--radius)", cursor: "pointer" }}>
              <div style={{ fontWeight: "500" }}>ლაშა გიორგაძე</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>გამარჯობა, კალენდართან...</div>
            </div>
          </div>

          {/* აქტიური ჩათის ფანჯარა მარჯვნივ */}
          <div style={{ padding: "24px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <h4 style={{ fontWeight: "600" }}>ლაშა გიორგაძე</h4>
              <hr style={{ border: "0", borderTop: "1px solid var(--border)", margin: "12px 0" }} />
              <p style={{ background: "var(--bg)", padding: "12px", borderRadius: "var(--radius)", width: "fit-content" }}>
                მათემატიკის მომზადება მინდა მე-11 კლასის მოსწავლისთვის.
              </p>
            </div>
            
            {/* მესიჯის შესაყვანი */}
            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <input type="text" placeholder="ჩაწერეთ შეტყობინება..." style={{ flex: 1, padding: "12px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }} />
              <button className="btn btn-primary">გაგზავნა</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}