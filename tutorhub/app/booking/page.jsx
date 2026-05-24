import Navbar from "@/components/Navbar";

export default function BookingPage() {
  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: "600px", margin: "40px auto", padding: "0 24px" }}>
        
        {/* Step Progress Bar */}
        <div className="step-bar">
          <div className="step active">1</div>
          <div className="step">2</div>
          <div className="step">3</div>
        </div>

        <div className="card">
          <h2 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px" }}>ნაბიჯი 1: გაკვეთილის ფორმატი</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <label style={{ padding: "16px", border: "2px solid var(--green)", borderRadius: "var(--radius)", display: "flex", justifyContent: "space-between", cursor: "pointer" }}>
              <div>
                <strong style={{ display: "block" }}>🌐 ონლაინ გაკვეთილი</strong>
                <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Google Meet / Zoom პლატფორმაზე</span>
              </div>
              <input type="radio" defaultChecked name="format" />
            </label>
            <label style={{ padding: "16px", border: "1px solid var(--border)", borderRadius: "var(--radius)", display: "flex", justifyContent: "space-between", cursor: "pointer" }}>
              <div>
                <strong style={{ display: "block" }}>🏫 პირისპირ (ადგილზე)</strong>
                <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>მასწავლებელთან ან მოსწავლესთან ბინაზე</span>
              </div>
              <input type="radio" name="format" />
            </label>
          </div>

          <button className="nav-btn btn-green" style={{ width: "100%", marginTop: "24px", padding: "12px" }}>გაგრძელება (შემდეგი ნაბიჯი)</button>
        </div>

      </div>
    </div>
  );
}