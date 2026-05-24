import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function ProfilePage() {
  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: "1200px", margin: "40px auto", padding: "0 24px", display: "grid", gridTemplateColumns: "1fr 380px", gap: "32px" }}>
        
        {/* მარცხენა მხარე: ინფორმაცია */}
        <div>
          <div className="card" style={{ display: "flex", gap: "24px", alignItems: "center" }}>
            <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "var(--green-light)", color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", fontWeight: "700" }}>ნხ</div>
            <div>
              <h1 style={{ fontSize: "24px", fontWeight: "700" }}>ნიკოლოზ ხუციშვილი</h1>
              <p style={{ color: "var(--text-muted)" }}>მათემატიკა · 8 წლიანი გამოცდილება</p>
              <div style={{ marginTop: "8px" }}><span className="badge badge-green">⭐ 4.9 (24 შეფასება)</span></div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "12px" }}>ჩემ შესახებ</h3>
            <p style={{ color: "var(--text-muted)", lineHeight: "1.7" }}>მოგესალმებით! ვარ სერტიფიცირებული მათემატიკის რეპეტიტორი. ვამზადებ მოსწავლეებს როგორც ეროვნული გამოცდებისთვის, ასევე სასკოლო ოლიმპიადებისთვის.</p>
          </div>
        </div>

        {/* მარჯვენა მხარე: Booking Card კალენდრით */}
        <div className="card" style={{ height: "fit-content" }}>
          <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "4px" }}>30 ₾ <span style={{ fontSize: "14px", fontWeight: "400", color: "var(--text-muted)" }}>/ საათი</span></h3>
          <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--border)" }} />
          
          <h4 style={{ fontWeight: "600" }}>აირჩიეთ თარიღი:</h4>
          <div className="cal-grid">
            <div className="cal-day disabled">22</div>
            <div className="cal-day disabled">23</div>
            <div className="cal-day active">24</div>
            <div className="cal-day">25</div>
            <div className="cal-day">26</div>
            <div className="cal-day">27</div>
            <div className="cal-day">28</div>
          </div>

          <Link href="/booking" style={{ textDecoration: "none" }}>
            <button className="nav-btn btn-green" style={{ width: "100%", marginTop: "24px", padding: "12px" }}>გაკვეთილის დაჯავშნა</button>
          </Link>
        </div>

      </div>
    </div>
  );
}