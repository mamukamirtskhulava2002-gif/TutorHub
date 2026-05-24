import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function SearchPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar />
      
      <div style={{ maxWidth: "1200px", margin: "40px auto", width: "100%", padding: "0 24px", flex: 1 }}>
        <h2 style={{ fontSize: "24px", fontWeight: "700", marginBottom: "24px" }}>რეპეტიტორების ძებნა</h2>
        
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "32px" }}>
          {/* ფილტრები */}
          <div style={{ background: "var(--white)", padding: "24px", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", height: "fit-content" }}>
            <h3 style={{ fontWeight: "600", marginBottom: "16px" }}>ფილტრები</h3>
            {/* აქ ჩაჯდება თქვენი ფილტრების HTML შიგთავსი */}
            <p style={{ color: "var(--text-muted)" }}>საგნები, ფასები და რეიტინგი...</p>
          </div>

          {/* მასწავლებლების სია */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* ერთი მასწავლებლის ბარათის ნიმუში */}
            <div style={{ background: "var(--white)", padding: "24px", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--green-light)", color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700" }}>ნხ</div>
                <div>
                  <h4 style={{ fontWeight: "600", fontSize: "16px" }}>ნიკოლოზ ხუციშვილი</h4>
                  <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>მათემატიკა, ფიზიკა</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}