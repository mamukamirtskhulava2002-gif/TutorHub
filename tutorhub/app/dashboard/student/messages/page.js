"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

// მოსწავლის ნავიგაცია (შეცვალე შენი სტრუქტურის მიხედვით, თუ განსხვავებულია)
const NAV_ITEMS = [
  { icon:"📊", label:"მთავარი",        href:"/dashboard/student" },
  { icon:"🔍", label:"მასწავლებლები", href:"/tutors" },
  { icon:"📅", label:"ჯავშნები",       href:"/dashboard/student/bookings" },
  { icon:"✉️", label:"შეტყობინებები", href:"/dashboard/student/messages" },
  { icon:"👤", label:"პროფილი",        href:"/dashboard/student/profile" },
];

export default function StudentMessagesPage() {
  const pathname = usePathname();
  const router   = useRouter();
  const [studentName, setStudentName] = useState("სტუდენტი");
  const [currentUser, setCurrentUser] = useState(null);
  const [chats, setChats]             = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages]       = useState([]);
  const [message, setMessage]         = useState("");
  const [loading, setLoading]         = useState(true);
  const [uploading, setUploading]     = useState(false);
  const [previewFile, setPreviewFile] = useState(null); // { url, type }
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }
      const user = session.user;
      setCurrentUser(user);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      if (profile?.full_name) setStudentName(profile.full_name.split(" ")[0]);

      await loadChats(user, supabase);
      setLoading(false);
    }
    fetchData();
  }, []);

  async function loadChats(user, supabase) {
    const { data } = await supabase
      .from("messages")
      .select("sender_id, receiver_id")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    const seen = new Set();
    const otherIds = [];

    (data || []).forEach(msg => {
      const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      if (!seen.has(otherId)) {
        seen.add(otherId);
        otherIds.push(otherId);
      }
    });

    const uniqueChats = [];
    for (const otherId of otherIds) {
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", otherId)
        .single();
      const displayName = p?.role === "admin"
        ? "TutorHub მხარდაჭერა"
        : (p?.full_name || "მასწავლებელი");
      uniqueChats.push({ id: otherId, name: displayName });
    }

    setChats(uniqueChats);
    setActiveChatId(prev => prev || uniqueChats[0]?.id || null);
  }

  // პოლინგი ჩატებისთვის
  useEffect(() => {
    if (!currentUser) return;
    const supabase = createClient();
    const interval = setInterval(() => loadChats(currentUser, supabase), 3000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // პოლინგი შეტყობინებებისთვის
  useEffect(() => {
    if (!activeChatId || !currentUser) return;
    const supabase = createClient();

    async function fetchMessages() {
      const { data, error } = await supabase
        .from("messages")
        .select("id, content, sender_id, receiver_id, created_at, seen")
        .or(
          `and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeChatId}),` +
          `and(sender_id.eq.${activeChatId},receiver_id.eq.${currentUser.id})`
        )
        .order("created_at", { ascending: true });

      if (error) { console.error("fetchMessages:", error); return; }
      setMessages(data || []);

      const unseen = (data || []).filter(m => m.sender_id === activeChatId && !m.seen);
      if (unseen.length > 0) {
        await supabase.from("messages").update({ seen: true })
          .in("id", unseen.map(m => m.id));
      }
    }

    fetchMessages();
    const interval = setInterval(fetchMessages, 2000);
    return () => clearInterval(interval);
  }, [activeChatId, currentUser]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ჩამოტვირთვის ფუნქცია
  async function downloadFile(url, fileName) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName || "file";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("ჩამოტვირთვა ვერ მოხერხდა:", error);
      window.open(url, "_blank");
    }
  }

  async function handleSend() {
    if (!message.trim() || !currentUser || !activeChatId) return;
    const supabase = createClient();
    const content = message.trim();
    setMessage("");
    const { error } = await supabase.from("messages").insert({
      sender_id: currentUser.id,
      receiver_id: activeChatId,
      content,
      seen: false,
    });
    if (error) console.error("Send error:", error);
  }

  async function handleFileUpload(e, type = "file") {
    const file = e.target.files?.[0];
    if (!file || !currentUser || !activeChatId) return;

    const maxBytes = type === "video" ? 30 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      alert(`ფაილი ძალიან დიდია. მაქსიმუმ ${type === "video" ? "30MB" : "10MB"}.`);
      return;
    }

    setUploading(true);
    const supabase = createClient();

    const ext  = file.name.split(".").pop().toLowerCase();
    const path = `${currentUser.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("chat-files")
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      alert("ატვირთვა ვერ მოხერხდა.");
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("chat-files")
      .getPublicUrl(path);

    const isImage = /^image\//i.test(file.type);
    const isVideo = /^video\//i.test(file.type) || type === "video";

    let content;
    if (isImage) {
      content = `[IMAGE]${publicUrl}[/IMAGE]`;
    } else if (isVideo) {
      content = `[VIDEO]${publicUrl}[/VIDEO]`;
    } else {
      content = `[FILE]${file.name}|${publicUrl}[/FILE]`;
    }

    await supabase.from("messages").insert({
      sender_id: currentUser.id,
      receiver_id: activeChatId,
      content,
      seen: false,
    });

    setUploading(false);
    e.target.value = "";
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  const activeChat = chats.find(c => c.id === activeChatId);

  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString("ka-GE", { hour: "2-digit", minute: "2-digit" });
  }

  function renderContent(content) {
    // 1. ფოტო
    const imageMatch = content.match(/\[IMAGE\](.*?)\[\/IMAGE\]/);
    if (imageMatch) {
      return (
        <div>
          <img
            src={imageMatch[1]}
            alt="ფოტო"
            className="max-w-[220px] max-h-[200px] rounded-xl object-cover cursor-pointer mt-1 hover:opacity-95 transition-all"
            onClick={() => setPreviewFile({ url: imageMatch[1], type: "image" })}
          />
        </div>
      );
    }

    // 2. ვიდეო (ახლა მოსწავლეც სწორად დაარენდერებს!)
    const videoMatch = content.match(/\[VIDEO\](.*?)\[\/VIDEO\]/);
    if (videoMatch) {
      return (
        <div className="mt-1 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
          <video
            src={videoMatch[1]}
            controls
            preload="metadata"
            className="max-w-[240px] max-h-[220px] rounded-xl bg-black shadow-sm object-contain"
          />
        </div>
      );
    }

    // 3. ფაილი
    const fileMatch = content.match(/\[FILE\](.*?)\|(.*?)\[\/FILE\]/);
    if (fileMatch) {
      const [, fileName, fileUrl] = fileMatch;
      const ext = fileName.split(".").pop().toLowerCase();
      const icon =
        ext === "pdf" ? "📄" :
        ["doc","docx"].includes(ext) ? "📝" :
        ["xls","xlsx"].includes(ext) ? "📊" :
        ["zip","rar"].includes(ext) ? "🗜️" : "📎";

      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            downloadFile(fileUrl, fileName);
          }}
          className="flex items-center gap-3 p-2.5 bg-white hover:bg-gray-50 border border-gray-100 rounded-xl transition-all text-gray-800 font-medium mt-1 min-w-[210px] shadow-sm group cursor-pointer pointer-events-auto select-none text-left w-full max-w-[250px]"
        >
          <span className="text-xl bg-gray-50 w-9 h-9 flex items-center justify-center rounded-lg group-hover:scale-105 transition-transform shrink-0">{icon}</span>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-semibold truncate text-gray-900">{fileName}</span>
            <span className="text-[10px] text-emerald-600 font-medium mt-0.5 flex items-center gap-0.5">⬇️ ჩამოტვირთვა</span>
          </div>
        </button>
      );
    }

    return <p className="text-sm leading-relaxed">{content}</p>;
  }

  return (
    <div className="min-h-screen bg-gray-50 grid md:grid-cols-[240px_1fr]">

      {/* Preview Modal */}
      {previewFile && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewFile(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img
              src={previewFile.url}
              alt="Preview"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain"
            />
            <div className="flex gap-3 mt-4 justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const name = previewFile.url.split("/").pop() || "image.jpg";
                  downloadFile(previewFile.url, name);
                }}
                className="btn-primary px-6 py-2.5 text-sm"
              >
                ⬇️ გადმოწერა
              </button>
              <button onClick={() => setPreviewFile(null)} className="btn-secondary px-6 py-2.5 text-sm">
                დახურვა
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="hidden md:flex bg-white border-r border-gray-100 flex-col py-6">
        <Link href="/" className="text-lg font-black px-6 mb-6 block">
          Tutor<span className="text-emerald-600">Hub</span>
        </Link>
        <div className="flex items-center gap-3 px-4 py-3 mx-3 mb-4 bg-gray-50 rounded-2xl">
          <div className="avatar w-10 h-10 avatar-blue text-sm">{studentName.slice(0,2)}</div>
          <div>
            <p className="text-sm font-semibold">{studentName}</p>
            <p className="text-xs text-gray-400 font-medium">სტუდენტი</p>
          </div>
        </div>
        <nav className="space-y-0.5 flex-1">
          {NAV_ITEMS.map(({ icon, label, href }) => (
            <Link key={href} href={href} className={pathname === href ? "sidebar-item-active" : "sidebar-item"}>
              <span>{icon}</span> {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-gray-100 pt-3 mt-3">
          <button onClick={handleSignOut} className="sidebar-item text-red-400 w-full text-left">
            🚪 გასვლა
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="p-6 md:p-8 flex flex-col" style={{ height: "100vh" }}>
        <h1 className="text-2xl font-black text-gray-900 mb-4">✉️ შეტყობინებები</h1>

        <div className="flex flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-0">

          {/* მასწავლებლების სია */}
          <div className="w-64 border-r border-gray-100 flex flex-col shrink-0">
            <div className="p-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-700">მასწავლებლები</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="space-y-2 p-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                      <div className="w-9 h-9 bg-gray-200 rounded-2xl flex-shrink-0" />
                      <div className="flex-1"><div className="h-3 bg-gray-200 rounded w-2/3" /></div>
                    </div>
                  ))}
                </div>
              ) : chats.length === 0 ? (
                <p className="text-sm text-gray-400 text-center mt-8">შეტყობინებები არ არის</p>
              ) : (
                chats.map(chat => (
                  <div key={chat.id} onClick={() => setActiveChatId(chat.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all mb-1 ${
                      chat.id === activeChatId ? "bg-emerald-50 border border-emerald-200" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="avatar w-9 h-9 avatar-green text-sm shrink-0">
                      {chat.name?.[0] || "?"}
                    </div>
                    <p className="text-sm font-semibold truncate">{chat.name}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ჩატის ფანჯარა */}
          {activeChatId && activeChat ? (
            <div className="flex-1 flex flex-col min-w-0">
              <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                <div className="avatar w-9 h-9 avatar-green text-sm">{activeChat.name?.[0]}</div>
                <p className="font-semibold text-sm">{activeChat.name}</p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                {messages.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center mt-8">საუბარი ჯერ არ დაწყებულა</p>
                ) : (
                  messages.map((msg, idx) => {
                    const mine   = msg.sender_id === currentUser?.id;
                    const isLast = idx === messages.length - 1;
                    const isMediaOnly = msg.content.startsWith("[IMAGE]") || msg.content.startsWith("[FILE]") || msg.content.startsWith("[VIDEO]");

                    return (
                      <div key={msg.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                        <div className={`max-w-xs rounded-2xl text-sm ${
                          isMediaOnly
                            ? "bg-transparent"
                            : mine
                              ? "bg-emerald-600 text-white rounded-br-sm px-4 py-2.5"
                              : "bg-gray-100 text-gray-800 rounded-bl-sm px-4 py-2.5"
                        }`}>
                          {renderContent(msg.content)}
                          <p className={`text-xs mt-1 ${isMediaOnly ? "text-gray-400" : mine ? "text-emerald-200" : "text-gray-400"}`}>
                            {formatTime(msg.created_at)}
                          </p>
                        </div>
                        {mine && isLast && (
                          <p className="text-xs text-gray-400 mt-1 mr-1">
                            {msg.seen ? "✓✓ წაკითხული" : "✓ გაგზავნილი"}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* ინფუთის სექცია მედია ღილაკებით მოსწავლისთვის */}
              <div className="p-4 border-t border-gray-100">
                {uploading && (
                  <div className="flex items-center gap-2 mb-2 text-xs text-gray-400">
                    <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    იტვირთება მედია...
                  </div>
                )}
                <div className="flex gap-3 items-end">
                  
                  {/* 🖼️ ფოტო */}
                  <label className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-emerald-600 hover:border-emerald-300 cursor-pointer transition-all">
                    🖼️
                    <input ref={imageInputRef} type="file" className="hidden" accept="image/jpeg,image/png,image/gif,image/webp" onChange={e => handleFileUpload(e, "image")} disabled={uploading} />
                  </label>

                  {/* 🎥 ვიდეო (ახალი ღილაკი მოსწავლესთან!) */}
                  <label className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-emerald-600 hover:border-emerald-300 cursor-pointer transition-all" title="ვიდეოს გაგზავნა">
                    🎥
                    <input ref={videoInputRef} type="file" className="hidden" accept="video/mp4,video/webm,video/ogg,video/quicktime" onChange={e => handleFileUpload(e, "video")} disabled={uploading} />
                  </label>

                  {/* 📎 ფაილი */}
                  <label className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-emerald-600 hover:border-emerald-300 cursor-pointer transition-all">
                    📎
                    <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar" onChange={e => handleFileUpload(e, "file")} disabled={uploading} />
                  </label>

                  <input type="text" placeholder="ჩაწერეთ შეტყობინება..."
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                    className="input flex-1"
                    disabled={uploading}
                  />
                  <button onClick={handleSend} disabled={!message.trim() || uploading} className="btn-primary px-5 disabled:opacity-40 disabled:cursor-not-allowed h-10">
                    გაგზავნა
                  </button>
                </div>
                <p className="text-xs text-gray-300 mt-1.5">
                  🖼️ სურათი · 🎥 ვიდეო (MP4, WEBM მაქს 30MB) · 📎 ფაილი (PDF, DOC, TXT)
                </p>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <p className="text-sm">აირჩიეთ საუბარი</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}