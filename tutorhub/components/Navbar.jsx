import Link from "next/link";

export default function Navbar() {
  return (
    <div className="navbar">
      <Link href="/" className="logo">
        TutorHub <span>Georgia</span>
      </Link>
      <div className="nav-links">
        <Link href="/" className="nav-link">🏠 მთავარი</Link>
        <Link href="/search" className="nav-link">🔍 ძებნა</Link>
        <Link href="/auth" className="nav-link">🔐 ავტორიზაცია</Link>
        <Link href="/dashboard/student" className="nav-link">🎓 სტუდენტი</Link>
        <Link href="/dashboard/tutor" className="nav-link">👨‍🏫 მასწავლებელი</Link>
        <Link href="/dashboard/parent" className="nav-link">👨‍👩‍👧 მშობელი</Link>
        <Link href="/dashboard/admin" className="nav-link">⚙️ ადმინი</Link>
        <Link href="/messages" className="nav-link">✉️ ჩათი</Link>
      </div>
    </div>
  );
}