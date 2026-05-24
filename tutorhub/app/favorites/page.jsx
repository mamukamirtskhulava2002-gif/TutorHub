import Navbar from "@/components/Navbar";

export default function FavoritesPage() {
  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: "1200px", margin: "40px auto", padding: "0 24px" }}>
        <h1 style={{ fontSize: "26px", fontWeight: "700", marginBottom: "24px" }}>❤️ ჩემი ფავორიტი მასწავლებლები</h1>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "24px" }}>
          <div className="card">
            <strong>ნიკოლოზ ხუციშვილი</strong>
            <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>მათემატიკა, ფიზიკა</p>
            <button className="nav-btn btn-green" style={{ width: "100%", marginTop: "16px", padding: "8px" }}>პროფილის ნახვა</button>
          </div>
        </div>
      </div>
    </div>
  );
}