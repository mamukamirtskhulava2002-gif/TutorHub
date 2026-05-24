"use client"; // აუცილებელია React-ის ფუნქციებისთვის (useState, Click-ები)

import { useState } from "react";

export default function App() {
  // 1. მართავს აქტიურ გვერდს (ზუსტად თქვენი 12 გვერდის სია)
  const [activePage, setActivePage] = useState("landing");
  
  // 2. მართავს Dark Mode-ს
  const [darkMode, setDarkMode] = useState(false);

  // 3. მართავს ჩათის მესიჯებს
  const [messages, setMessages] = useState([
    { text: "გამარჯობა, მათემატიკის მომზადება მინდა მე-11 კლასის მოსწავლისთვის. გაქვთ თავისუფალი ადგილი?", time: "14:32", mine: false },
    { text: "მოგესალმებით! დიახ, სამშაბათს და პარასკევს მაქვს 18:00 საათზე თავისუფალი ადგილები.", time: "14:35", mine: true }
  ]);
  const [inputText, setInputText] = useState("");

  // მესიჯის გაგზავნის ფუნქცია
  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    
    setMessages([...messages, { text: inputText, time: currentTime, mine: true }]);
    setInputText("");
  };

  return (
    <div className={darkMode ? "dark-theme" : ""} style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", display: "flex", flexDirection: "column" }}>
      
      {/* ===== მენიუ (NAVBAR) ===== */}
      <div className="navbar">
        <div className="logo" onClick={() => setActivePage("landing")} style={{ cursor: "pointer" }}>
          TutorHub <span>Georgia</span>
        </div>
        <div className="nav-links">
          <button className={`nav-link ${activePage === "landing" ? "active" : ""}`} onClick={() => setActivePage("landing")}>მთავარი</button>
          <button className={`nav-link ${activePage === "search" ? "active" : ""}`} onClick={() => setActivePage("search")}>🔍 ძებნა</button>
          <button className={`nav-link ${activePage === "profile" ? "active" : ""}`} onClick={() => setActivePage("profile")}>👤 პროფილი</button>
          <button className={`nav-link ${activePage === "student-dash" ? "active" : ""}`} onClick={() => setActivePage("student-dash")}>🎓 სტუდენტი</button>
          <button className={`nav-link ${activePage === "tutor-dash" ? "active" : ""}`} onClick={() => setActivePage("tutor-dash")}>👨‍🏫 მასწავლებელი</button>
          <button className={`nav-link ${activePage === "parent-dash" ? "active" : ""}`} onClick={() => setActivePage("parent-dash")}>👨‍👩‍👧 მშობელი</button>
          <button className={`nav-link ${activePage === "messages" ? "active" : ""}`} onClick={() => setActivePage("messages")}>✉️ ჩათი</button>
          <button className={`nav-link ${activePage === "admin" ? "active" : ""}`} onClick={() => setActivePage("admin")}>⚙️ ადმინი</button>
          
          {/* Dark Mode ტოგლი */}
          <button className="nav-btn btn-outline" onClick={() => setDarkMode(!darkMode)} style={{ padding: "8px 12px" }}>
            {darkMode ? "☀️" : "🌙"}
          </button>
          <button className="nav-btn btn-green" onClick={() => setActivePage("auth")}>შესვლა</button>
        </div>
      </div>

      {/* ===== გვერდების კონტენტი (პირობითი რენდერინგი) ===== */}
      <div style={{ flex: 1, padding: activePage === "messages" ? "0" : "40px 24px", maxWidth: activePage === "messages" ? "100%" : "1200px", margin: "0 auto", width: "100%" }}>
        
        {/* 1. LANDING / მთავარი გვერდი */}
        {activePage === "landing" && (
          <div>
            <div className="hero">
              <div className="hero-badge">✨ საქართველოს წამყვანი პლატფორმა</div>
              <h1>იპოვე საუკეთესო <em>რეპეტიტორი</em></h1>
              <p>ისწავლე მარტივად გამოცდილი მასწავლებლებისგან. აღმოაჩინე შენზე მორგებული გრაფიკი და ფასი.</p>
              <div className="hero-search">
                <select><option>რისი სწავლა გსურს?</option><option>მათემატიკა</option><option>ფიზიკა</option></select>
                <select><option>ონლაინ / თბილისი</option><option>ონლაინ</option></select>
                <button className="nav-btn btn-green" onClick={() => setActivePage("search")}>ძებნა</button>
              </div>
            </div>
          </div>
        )}

        {/* 2. SEARCH / ძებნის გვერდი */}
        {activePage === "search" && (
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "32px" }}>
            <div className="card">
              <h3 style={{ fontWeight: "600", marginBottom: "16px" }}>ფილტრები</h3>
              <label style={{ display: "block", marginBottom: "8px" }}>საგანი</label>
              <select style={{ width: "100%", padding: "8px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}><option>ყველა</option><option>მათემატიკა</option></select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div className="tutor-card" onClick={() => setActivePage("profile")}>
                <div className="tutor-card-header">
                  <div className="avatar avatar-green">ნხ</div>
                  <div>
                    <div className="tutor-name">ნიკოლოზ ხუციშვილი</div>
                    <div className="tutor-subject">მათემატიკა, ფიზიკა</div>
                  </div>
                  <div style={{ marginLeft: "auto", textAlign: "right" }}>
                    <div className="tutor-price">30 ₾<span>/სთ</span></div>
                    <div className="tutor-rating">⭐ 4.9</div>
                  </div>
                </div>
                <p className="tutor-bio">ვარ სერტიფიცირებული მასწავლებელი 8 წლიანი გამოცდილებით...</p>
                <button className="nav-btn btn-green" style={{ width: "100%" }}>პროფილის ნახვა</button>
              </div>
            </div>
          </div>
        )}

        {/* 3. PROFILE / პროფილის გვერდი */}
        {activePage === "profile" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "32px" }}>
            <div>
              <div className="card" style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                <div className="avatar avatar-green" style={{ width: "60px", height: "60px", fontSize: "20px" }}>ნხ</div>
                <div>
                  <h2>ნიკოლოზ ხუციშვილი</h2>
                  <p style={{ color: "var(--text-muted)" }}>მათემატიკა · სერტიფიცირებული</p>
                </div>
              </div>
              <div className="card">
                <h3>ბიოგრაფია</h3>
                <p style={{ color: "var(--text-muted)", marginTop: "8px" }}>დეტალური ინფორმაცია მასწავლებელზე და გამოცდილებაზე...</p>
              </div>
            </div>
            <div className="card">
              <h3>30 ₾ / საათი</h3>
              <div className="cal-grid" style={{ margin: "16px 0" }}>
                <div className="cal-day active">25</div>
                <div className="cal-day">26</div>
                <div className="cal-day">27</div>
              </div>
              <button className="nav-btn btn-green" style={{ width: "100%" }} onClick={() => setActivePage("booking")}>დაჯავშნა</button>
            </div>
          </div>
        )}

        {/* 4. BOOKING / დაჯავშნა */}
        {activePage === "booking" && (
          <div className="card" style={{ maxWidth: "500px", margin: "0 auto", textAlign: "center" }}>
            <div className="step-bar"><div className="step active">1</div><div className="step">2</div><div className="step">3</div></div>
            <h2>გაკვეთილის ფორმატი</h2>
            <button className="nav-btn btn-green" style={{ width: "100%", marginTop: "24px" }} onClick={() => { alert("დაჯავშნა წარმატებით დასრულდა!"); setActivePage("student-dash"); }}>დადასტურება</button>
          </div>
        )}

        {/* 5. MESSAGES / ჩათი (სრულად ფუნქციური) */}
        {activePage === "messages" && (
          <div className="msg-layout">
            <div className="chat-list">
              <div className="chat-item active">
                <div className="avatar avatar-blue">ლგ</div>
                <div><strong>ლაშა გიორგაძე</strong><p style={{ fontSize: "12px", color: "var(--text-muted)" }}>ონლაინ</p></div>
              </div>
            </div>
            <div className="msg-main">
              <div className="msg-header"><h4>ლაშა გიორგაძე</h4></div>
              <div className="msg-body">
                {messages.map((msg, index) => (
                  <div key={index} className={`bubble-wrap ${msg.mine ? "mine" : ""}`} style={{ display: "flex", flexDirection: "column", alignItems: msg.mine ? "flex-end" : "flex-start", width: "100%" }}>
                    <div className={msg.mine ? "bubble mine" : "bubble other"}>{msg.text}</div>
                    <div className="msg-time" style={{ fontSize: "10px", color: "var(--text-light)", marginTop: "2px" }}>{msg.time}</div>
                  </div>
                ))}
              </div>
              <div className="msg-input-area">
                <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSendMessage()} placeholder="ჩაწერეთ შეტყობინება..." />
                <button className="nav-btn btn-green" onClick={handleSendMessage}>გაგზავნა</button>
              </div>
            </div>
          </div>
        )}

        {/* 6. STUDENT DASH / სტუდენტი */}
        {activePage === "student-dash" && (
          <div>
            <h2 style={{ marginBottom: "24px" }}>სტუდენტის პანელი 🎓</h2>
            <div className="stats-grid">
              <div className="stat-card"><h3>12</h3><p>ჩატარებული გაკვეთილი</p></div>
              <div className="stat-card"><h3>60 ₾</h3><p>ამ თვის ბალანსი</p></div>
            </div>
          </div>
        )}

        {/* 7. TUTOR DASH / მასწავლებელი */}
        {activePage === "tutor-dash" && (
          <div>
            <h2 style={{ marginBottom: "24px" }}>მასწავლებლის კაბინეტი 👨‍🏫</h2>
            <div className="stats-grid">
              <div className="stat-card"><h3 style={{ color: "var(--green)" }}>1,240 ₾</h3><p>შემოსავალი</p></div>
              <div className="stat-card"><h3>⭐ 4.9</h3><p>რეიტინგი</p></div>
            </div>
          </div>
        )}

        {/* 8. PARENT DASH / მშობელი */}
        {activePage === "parent-dash" && (
          <div className="card">
            <h2>მშობლის კონტროლი 👨‍👩‍👧</h2>
            <p style={{ marginTop: "12px", color: "var(--text-muted)" }}>თქვენი შვილის (ლუკა ხუციშვილი) დასწრება: 100%</p>
          </div>
        )}

        {/* 9. ADMIN / ადმინი */}
        {activePage === "admin" && (
          <div className="card">
            <h2>ადმინისტრატორის პანელი ⚙️</h2>
            <p style={{ marginTop: "12px", color: "var(--text-muted)" }}>სისტემაში არის 2 ახალი მასწავლებელი ვერიფიკაციის მოლოდინში.</p>
          </div>
        )}

        {/* 10. AUTH / ავტორიზაცია */}
        {activePage === "auth" && (
          <div className="card" style={{ maxWidth: "400px", margin: "40px auto" }}>
            <h3 style={{ textAlign: "center", marginBottom: "16px" }}>სისტემაში შესვლა</h3>
            <input type="email" placeholder="ელ-ფოსტა" style={{ width: "100%", padding: "10px", marginBottom: "12px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }} />
            <input type="password" placeholder="პაროლი" style={{ width: "100%", padding: "10px", marginBottom: "16px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }} />
            <button className="nav-btn btn-green" style={{ width: "100%" }} onClick={() => setActivePage("student-dash")}>შესვლა</button>
          </div>
        )}

      </div>
    </div>
  );
}