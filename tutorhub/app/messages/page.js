"use client";

import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

// ─── helpers ────────────────────────────────────────────────────────────────
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("ka-GE", { hour: "2-digit", minute: "2-digit" });
}

function dateSeparatorLabel(isoStr) {
  const d = new Date(isoStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "დღეს";
  if (d.toDateString() === yesterday.toDateString()) return "გუშინ";
  return d.toLocaleDateString("ka-GE", { day: "numeric", month: "long" });
}

function relativeTimeShort(isoStr) {
  if (!isoStr) return "";
  const diffMs = Date.now() - new Date(isoStr);
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return "ახლა";
  if (diffMin < 60) return `${diffMin}წ`;
  if (diffHrs < 24) return `${diffHrs}სთ`;
  if (diffDays === 1) return "გუშინ";
  return new Date(isoStr).toLocaleDateString("ka-GE", { day: "numeric", month: "short" });
}

function previewContent(content) {
  if (!content) return "";
  if (content === "[DELETED]") return "შეტ. წაიშალა";
  if (content.startsWith("[IMAGE]")) return "📷 ფოტო";
  if (content.startsWith("[VIDEO]")) return "🎥 ვიდეო";
  if (content.startsWith("[FILE]")) {
    const m = content.match(/\[FILE\](.*?)\|/);
    return `📎 ${m?.[1] || "ფაილი"}`;
  }
  if (content.startsWith("[REPLY:")) {
    const actual = content.replace(/^\[REPLY:[^\]]*\]\[\/REPLY\]/, "").trim();
    return actual.slice(0, 42) || "↩️ Reply";
  }
  if (content.startsWith("[FORWARD:")) {
    return "↪️ გადაგზავნილი";
  }
  return content.slice(0, 42);
}

function getReplyPreview(content) {
  if (!content) return "";
  if (content === "[DELETED]") return "შეტ. წაიშალა";
  if (content.includes("[IMAGE]")) return "📷 ფოტო";
  if (content.includes("[VIDEO]")) return "🎥 ვიდეო";
  if (content.includes("[FILE]")) {
    const m = content.match(/\[FILE\](.*?)\|/);
    return `📎 ${m?.[1] || "ფაილი"}`;
  }
  if (content.startsWith("[FORWARD:")) {
    const m = content.match(/^\[FORWARD:(.*?)\]([\s\S]*)\[\/FORWARD\]$/);
    return m ? `↪️ ${m[2].slice(0, 50)}` : "↪️ გადაგზავნილი";
  }
  if (content.startsWith("[REPLY:")) {
    const actual = content.replace(/^\[REPLY:[^\]]*\]\[\/REPLY\]/, "").trim();
    return actual.slice(0, 60);
  }
  return content.replace(/\n/g, " ").slice(0, 60);
}

const EMOJIS = [
  "😊","😂","❤️","👍","👏","🙏","🎉","🔥",
  "✅","⭐","💪","😍","🤔","😅","📚","✍️",
  "🎯","⏰","💡","🌟","👋","💬","😮","🙌",
];

const BTN_ACTION = "w-6 h-6 bg-white border border-gray-200 rounded-full shadow-sm flex items-center justify-center text-[11px] hover:border-emerald-300 hover:bg-emerald-50 transition-all shrink-0";

// ─── main ────────────────────────────────────────────────────────────────────
function MessagesContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [currentUser, setCurrentUser]         = useState(null);
  const [chats, setChats]                     = useState([]);
  const [activeChatId, setActiveChatId]       = useState(null);
  const [messages, setMessages]               = useState([]);
  const [message, setMessage]                 = useState("");
  const [loading, setLoading]                 = useState(true);
  const [uploading, setUploading]             = useState(false);
  const [previewFile, setPreviewFile]         = useState(null);
  const [unreadCounts, setUnreadCounts]       = useState({});
  const [lastMessages, setLastMessages]       = useState({});
  const [emojiOpen, setEmojiOpen]             = useState(false);
  const [showScrollBtn, setShowScrollBtn]     = useState(false);
  const [newMsgCount, setNewMsgCount]         = useState(0);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [partnerIsTutor, setPartnerIsTutor]   = useState(false);
  const [deletingId, setDeletingId]           = useState(null);
  const [hoveredMsgId, setHoveredMsgId]       = useState(null);
  const [replyTo, setReplyTo]                 = useState(null); // { id, content, senderName }
  const [forwardMsg, setForwardMsg]           = useState(null); // { content, senderName }
  const [forwardTargetId, setForwardTargetId] = useState("");
  const [forwardModalOpen, setForwardModalOpen] = useState(false);

  const bottomRef          = useRef(null);
  const chatScrollRef      = useRef(null);
  const textareaRef        = useRef(null);
  const fileInputRef       = useRef(null);
  const imageInputRef      = useRef(null);
  const videoInputRef      = useRef(null);
  const presenceChannelRef = useRef(null);
  const typingTimeoutRef   = useRef(null);
  const prevMsgCountRef    = useRef(0);
  const isInitialLoadRef   = useRef(true);
  const emojiRef           = useRef(null);
  const deletedIdsRef      = useRef(new Set());

  // ─── auth ───
  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }
      const user = session.user;
      setCurrentUser(user);
      const userParam = searchParams.get("user");
      await loadChats(user, supabase, userParam);
      setLoading(false);
    }
    fetchData();
  }, [searchParams]);

  // ─── close emoji on outside click ───
  useEffect(() => {
    function handler(e) {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) {
        setEmojiOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ─── load chat list (with last message + unread count) ───
  async function loadChats(user, supabase, userParam) {
    const { data } = await supabase
      .from("messages")
      .select("sender_id, receiver_id, content, created_at, seen")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    const seenSet    = new Set();
    const otherIds   = [];
    const lastMsgMap = {};
    const unreadMap  = {};

    (data || []).forEach(msg => {
      const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      if (!seenSet.has(otherId)) {
        seenSet.add(otherId);
        otherIds.push(otherId);
        lastMsgMap[otherId] = { content: msg.content, created_at: msg.created_at };
      }
      if (msg.sender_id !== user.id && !msg.seen) {
        unreadMap[otherId] = (unreadMap[otherId] || 0) + 1;
      }
    });

    // For parents: also show children in chat list even without existing messages
    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role === "parent") {
      const { data: children } = await supabase
        .from("parent_children").select("child_id").eq("parent_id", user.id);
      for (const c of (children || [])) {
        if (!seenSet.has(c.child_id)) {
          seenSet.add(c.child_id);
          otherIds.push(c.child_id);
        }
      }
    }

    if (userParam && !seenSet.has(userParam)) otherIds.unshift(userParam);

    setLastMessages(prev => ({ ...prev, ...lastMsgMap }));
    setUnreadCounts(prev => ({ ...prev, ...unreadMap }));

    const uniqueChats = [];
    for (const otherId of otherIds) {
      const { data: p } = await supabase
        .from("profiles").select("full_name, role").eq("id", otherId).single();
      const displayName = p?.role === "admin"
        ? "TutorHub მხარდაჭერა"
        : (p?.full_name || "მომხმარებელი");
      uniqueChats.push({ id: otherId, name: displayName });
    }
    setChats(uniqueChats);
    setActiveChatId(prev => {
      if (prev) return prev;
      if (userParam) return userParam;
      return uniqueChats[0]?.id || null;
    });
  }

  // ─── chat list polling ───
  useEffect(() => {
    if (!currentUser) return;
    const supabase = createClient();
    const userParam = searchParams.get("user");
    const interval = setInterval(() => loadChats(currentUser, supabase, userParam), 5000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // ─── check if partner is a tutor ───
  useEffect(() => {
    if (!activeChatId) return;
    setPartnerIsTutor(false);
    const supabase = createClient();
    supabase.from("tutors").select("id").eq("id", activeChatId).single()
      .then(({ data }) => setPartnerIsTutor(!!data));
  }, [activeChatId]);

  // ─── typing indicator via Realtime Presence ───
  useEffect(() => {
    if (!activeChatId || !currentUser) return;
    const supabase = createClient();

    if (presenceChannelRef.current) {
      supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
    }

    const channelName = `typing_${[currentUser.id, activeChatId].sort().join("_")}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: currentUser.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state   = channel.presenceState();
        const partner = state[activeChatId]?.[0];
        setIsPartnerTyping(partner?.typing === true);
      })
      .subscribe(async status => {
        if (status === "SUBSCRIBED") {
          await channel.track({ typing: false });
        }
      });

    presenceChannelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      presenceChannelRef.current = null;
    };
  }, [activeChatId, currentUser]);

  // ─── messages polling ───
  useEffect(() => {
    if (!activeChatId || !currentUser) return;
    prevMsgCountRef.current = 0;
    isInitialLoadRef.current = true;
    setNewMsgCount(0);

    async function fetchMessages() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("messages")
        .select("id, content, sender_id, receiver_id, created_at, seen")
        .or(
          `and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeChatId}),` +
          `and(sender_id.eq.${activeChatId},receiver_id.eq.${currentUser.id})`
        )
        .order("created_at", { ascending: true });

      if (error) { console.error("fetchMessages:", error); return; }

      const msgs = (data || []).map(m =>
        deletedIdsRef.current.has(m.id) ? { ...m, content: "[DELETED]" } : m
      );
      setMessages(msgs);

      const el = chatScrollRef.current;
      const distFromBottom = el ? el.scrollHeight - el.scrollTop - el.clientHeight : 0;

      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
        prevMsgCountRef.current = data?.length || 0;
        if (el) el.scrollTop = el.scrollHeight;
      } else {
        const newCount = (data?.length || 0) - prevMsgCountRef.current;
        if (newCount > 0) {
          if (distFromBottom < 200) {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
          } else {
            setNewMsgCount(prev => prev + newCount);
          }
        }
        prevMsgCountRef.current = data?.length || 0;
      }

      const unseen = (data || []).filter(m => m.sender_id === activeChatId && !m.seen);
      if (unseen.length > 0) {
        await supabase.from("messages").update({ seen: true })
          .in("id", unseen.map(m => m.id));
        setUnreadCounts(prev => ({ ...prev, [activeChatId]: 0 }));
      }
    }

    fetchMessages();
    const interval = setInterval(fetchMessages, 2000);
    return () => clearInterval(interval);
  }, [activeChatId, currentUser]);

  // ─── scroll handler ───
  function handleScroll() {
    const el = chatScrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 300);
    if (distFromBottom < 100) setNewMsgCount(0);
  }

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setNewMsgCount(0);
  }

  // ─── typing broadcast ───
  function handleTyping(value) {
    setMessage(value);
    if (!presenceChannelRef.current) return;
    presenceChannelRef.current.track({ typing: true });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      presenceChannelRef.current?.track({ typing: false });
    }, 2000);
  }

  // ─── auto-resize textarea ───
  function autoResize(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  // ─── send ───
  async function handleSend() {
    if (!message.trim() || !currentUser || !activeChatId) return;
    const supabase = createClient();
    let content = message.trim();

    if (replyTo) {
      const quoted = getReplyPreview(replyTo.content).slice(0, 80);
      content = `[REPLY:${replyTo.senderName}|||${quoted}][/REPLY]${content}`;
      setReplyTo(null);
    }

    setMessage("");
    if (textareaRef.current) textareaRef.current.style.height = "42px";
    presenceChannelRef.current?.track({ typing: false });
    clearTimeout(typingTimeoutRef.current);
    const { error } = await supabase.from("messages").insert({
      sender_id:   currentUser.id,
      receiver_id: activeChatId,
      content,
      seen: false,
    });
    if (error) console.error("Send error:", error);
  }

  // ─── delete (soft — replaces content) ───
  async function deleteMessage(msgId) {
    setDeletingId(msgId);
    deletedIdsRef.current.add(msgId);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: "[DELETED]" } : m));

    const supabase = createClient();
    const { error } = await supabase.from("messages")
      .update({ content: "[DELETED]" })
      .eq("id", msgId)
      .eq("sender_id", currentUser.id);

    if (error) console.error("Delete error:", error.message);
    setDeletingId(null);
  }

  // ─── forward ───
  async function handleForward(targetId) {
    if (!forwardMsg || !currentUser || !targetId) return;
    const supabase = createClient();
    const content = `[FORWARD:${forwardMsg.senderName}]${forwardMsg.content}[/FORWARD]`;
    await supabase.from("messages").insert({
      sender_id: currentUser.id, receiver_id: targetId, content, seen: false,
    });
    setForwardModalOpen(false);
    setForwardMsg(null);
    setForwardTargetId("");
  }

  // ─── start reply / forward helpers ───
  function startReply(msg) {
    const senderName = msg.sender_id === currentUser?.id ? "მე" : (activeChat?.name || "");
    setReplyTo({ id: msg.id, content: msg.content, senderName });
    textareaRef.current?.focus();
  }

  function startForward(msg) {
    const senderName = msg.sender_id === currentUser?.id ? "მე" : (activeChat?.name || "");
    setForwardMsg({ content: msg.content, senderName });
    setForwardTargetId("");
    setForwardModalOpen(true);
  }

  // ─── file upload ───
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
      .from("chat-files").upload(path, file, { contentType: file.type });
    if (uploadError) {
      console.error("Upload error:", uploadError);
      alert("ატვირთვა ვერ მოხერხდა.");
      setUploading(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("chat-files").getPublicUrl(path);
    const isImage = /^image\//i.test(file.type);
    const isVideo = /^video\//i.test(file.type) || type === "video";
    let content;
    if (isImage)      content = `[IMAGE]${publicUrl}[/IMAGE]`;
    else if (isVideo) content = `[VIDEO]${publicUrl}[/VIDEO]`;
    else              content = `[FILE]${file.name}|${publicUrl}[/FILE]`;
    await supabase.from("messages").insert({
      sender_id: currentUser.id, receiver_id: activeChatId, content, seen: false,
    });
    setUploading(false);
    e.target.value = "";
  }

  // ─── render message content ───
  function renderContent(content, mine) {
    if (content === "[DELETED]") {
      return <p className="text-sm italic opacity-50">შეტყობინება წაიშალა</p>;
    }

    // Reply block
    const replyMatch = content.match(/^\[REPLY:([^|]*)\|\|\|(.*?)\]\[\/REPLY\]([\s\S]*)$/);
    if (replyMatch) {
      const [, senderName, quotedText, actualMsg] = replyMatch;
      return (
        <div>
          <div className={`border-l-2 pl-2 mb-1.5 rounded-r py-0.5 ${mine ? "border-emerald-300 bg-emerald-700/20" : "border-gray-400 bg-gray-200/60"}`}>
            <p className={`text-[11px] font-semibold ${mine ? "text-emerald-200" : "text-gray-500"}`}>{senderName}</p>
            <p className={`text-xs opacity-80 line-clamp-2 ${mine ? "text-emerald-100" : "text-gray-600"}`}>{quotedText}</p>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{actualMsg.trim()}</p>
        </div>
      );
    }

    // Forward block
    const forwardMatch = content.match(/^\[FORWARD:(.*?)\]([\s\S]*)\[\/FORWARD\]$/);
    if (forwardMatch) {
      const [, senderName, forwardedContent] = forwardMatch;
      return (
        <div>
          <p className={`text-[11px] font-semibold mb-1.5 flex items-center gap-1 ${mine ? "text-emerald-200" : "text-gray-500"}`}>
            ↪️ გადაგზავნილი — {senderName}:
          </p>
          <div className={`border-l-2 pl-2 ${mine ? "border-emerald-300" : "border-gray-300"}`}>
            {renderContent(forwardedContent, mine)}
          </div>
        </div>
      );
    }

    const imageMatch = content.match(/\[IMAGE\](.*?)\[\/IMAGE\]/);
    if (imageMatch) {
      return (
        <img src={imageMatch[1]} alt="ფოტო"
          className="max-w-[220px] max-h-[200px] rounded-xl object-cover cursor-pointer mt-1"
          onClick={() => setPreviewFile({ url: imageMatch[1], type: "image" })} />
      );
    }
    const videoMatch = content.match(/\[VIDEO\](.*?)\[\/VIDEO\]/);
    if (videoMatch) {
      return (
        <video src={videoMatch[1]} controls preload="metadata"
          className="max-w-[240px] max-h-[220px] rounded-xl bg-black shadow-sm object-contain mt-1" />
      );
    }
    const fileMatch = content.match(/\[FILE\](.*?)\|(.*?)\[\/FILE\]/);
    if (fileMatch) {
      const [, fileName, fileUrl] = fileMatch;
      const ext = fileName.split(".").pop().toLowerCase();
      const icon = ext === "pdf" ? "📄" : ["doc","docx"].includes(ext) ? "📝"
        : ["xls","xlsx"].includes(ext) ? "📊" : ["zip","rar"].includes(ext) ? "🗜️" : "📎";
      return (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 mt-1 hover:underline underline-offset-2">
          <span className="text-xl">{icon}</span>
          <span className="text-sm font-medium truncate max-w-[160px]">{fileName}</span>
        </a>
      );
    }
    const oldFileMatch = content.match(/📎 \[ფაილი\]\((.*?)\)/);
    if (oldFileMatch) {
      const url = oldFileMatch[1];
      const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
      if (isImg) return <img src={url} alt="ფოტო" className="max-w-[200px] rounded-xl mt-1" />;
      return <a href={url} target="_blank" rel="noopener noreferrer" className="underline text-sm">📎 ფაილი</a>;
    }
    return <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>;
  }

  // ─── grouping helpers ───
  function shouldShowDate(idx) {
    if (idx === 0) return true;
    const prev = new Date(messages[idx - 1].created_at).toDateString();
    const curr = new Date(messages[idx].created_at).toDateString();
    return prev !== curr;
  }

  function isFirstInGroup(idx) {
    if (idx === 0 || shouldShowDate(idx)) return true;
    return messages[idx - 1].sender_id !== messages[idx].sender_id;
  }

  function isLastInGroup(idx) {
    if (idx === messages.length - 1) return true;
    if (new Date(messages[idx].created_at).toDateString() !==
        new Date(messages[idx + 1].created_at).toDateString()) return true;
    return messages[idx + 1].sender_id !== messages[idx].sender_id;
  }

  const activeChat = chats.find(c => c.id === activeChatId);

  // ─── render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Image preview modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewFile(null)}>
          <div className="relative max-w-3xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img src={previewFile.url} alt="Preview"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain" />
            <div className="flex gap-3 mt-4 justify-center">
              <a href={previewFile.url} download target="_blank" rel="noopener noreferrer"
                className="btn-primary px-6 py-2.5 text-sm" onClick={e => e.stopPropagation()}>
                ⬇️ გადმოწერა
              </a>
              <button onClick={() => setPreviewFile(null)} className="btn-secondary px-6 py-2.5 text-sm">
                დახურვა
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forward modal */}
      {forwardModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => { setForwardModalOpen(false); setForwardMsg(null); setForwardTargetId(""); }}>
          <div className="bg-white rounded-2xl p-5 w-80 max-h-[70vh] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-1">↪️ გადაგზავნა</h3>
            <p className="text-xs text-gray-400 mb-3">აირჩიეთ ვისთვის გადაგზავნოთ</p>
            <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
              {chats.map(chat => (
                <div key={chat.id}
                  onClick={() => setForwardTargetId(chat.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                    forwardTargetId === chat.id
                      ? "bg-emerald-50 border border-emerald-200"
                      : "hover:bg-gray-50"
                  }`}>
                  <div className="avatar w-9 h-9 avatar-green text-sm shrink-0">
                    {chat.name?.[0] || "?"}
                  </div>
                  <p className="text-sm font-medium text-gray-800">{chat.name}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
              <button
                onClick={() => { setForwardModalOpen(false); setForwardMsg(null); setForwardTargetId(""); }}
                className="btn-secondary flex-1 py-2 text-sm">
                გაუქმება
              </button>
              <button
                onClick={() => handleForward(forwardTargetId)}
                disabled={!forwardTargetId}
                className="btn-primary flex-1 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                გაგზავნა
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="dash-container flex-1">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="px-3 py-2 mb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">მენიუ</p>
          </div>
          <Link href="/dashboard/student"          className="sidebar-link">📊 დაშბორდი</Link>
          <Link href="/search"                     className="sidebar-link">🔍 მასწავლებლები</Link>
          <Link href="/dashboard/student/lessons"  className="sidebar-link">📅 ჩემი გაკვეთილები</Link>
          <Link href="/messages"                   className="sidebar-link active">💬 შეტყობინებები</Link>
          <Link href="/favorites"                  className="sidebar-link">❤️ ფავორიტები</Link>
          <Link href="/dashboard/student/payments" className="sidebar-link">💳 გადახდები</Link>
          <Link href="/dashboard/student/settings" className="sidebar-link">⚙️ პარამეტრები</Link>
        </div>

        {/* Chat area */}
        <div className="main-content p-0 flex">
          <div className="flex w-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            style={{ height: "calc(100vh - 80px)" }}>

            {/* ─── Chat list ─── */}
            <div className="w-72 border-r border-gray-100 flex flex-col shrink-0">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">💬 შეტყობინებები</h3>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="p-2 space-y-1">
                    {[1,2,3].map(i => (
                      <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                        <div className="w-10 h-10 bg-gray-200 rounded-2xl shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 bg-gray-200 rounded w-2/3" />
                          <div className="h-2 bg-gray-100 rounded w-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : chats.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <p className="text-3xl mb-2">💬</p>
                    <p className="text-sm text-gray-400 mb-3">შეტყობინებები არ არის</p>
                    <Link href="/search"
                      className="text-xs text-emerald-600 hover:underline font-medium">
                      მასწავლებლების ძიება →
                    </Link>
                  </div>
                ) : (
                  <div className="p-2 space-y-0.5">
                    {chats.map(chat => {
                      const last   = lastMessages[chat.id];
                      const unread = unreadCounts[chat.id] || 0;
                      return (
                        <div key={chat.id}
                          onClick={() => {
                            setActiveChatId(chat.id);
                            setReplyTo(null);
                            setUnreadCounts(prev => ({ ...prev, [chat.id]: 0 }));
                          }}
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                            chat.id === activeChatId
                              ? "bg-emerald-50 border border-emerald-200"
                              : "hover:bg-gray-50"
                          }`}>
                          <div className="avatar w-10 h-10 avatar-green text-sm shrink-0">
                            {chat.name?.[0] || "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className={`text-sm truncate ${
                                unread > 0 ? "font-bold text-gray-900" : "font-semibold text-gray-700"
                              }`}>
                                {chat.name}
                              </p>
                              {last?.created_at && (
                                <p className="text-[11px] text-gray-400 shrink-0">
                                  {relativeTimeShort(last.created_at)}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-1">
                              <p className={`text-xs truncate ${
                                unread > 0 ? "text-gray-700 font-medium" : "text-gray-400"
                              }`}>
                                {last ? previewContent(last.content) : ""}
                              </p>
                              {unread > 0 && (
                                <span className="shrink-0 min-w-5 h-5 bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                                  {unread > 9 ? "9+" : unread}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ─── Chat window ─── */}
            {activeChatId && activeChat ? (
              <div className="flex-1 flex flex-col min-w-0">

                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 shrink-0">
                  <div className="avatar w-9 h-9 avatar-green text-sm shrink-0">
                    {activeChat.name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-tight truncate">{activeChat.name}</p>
                    {isPartnerTyping ? (
                      <p className="text-xs text-emerald-500 font-medium">აკრეფს...</p>
                    ) : (
                      <p className="text-xs text-gray-400">ონლაინი</p>
                    )}
                  </div>
                  {partnerIsTutor && (
                    <Link href={`/booking/${activeChatId}`}
                      className="shrink-0 text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-xl font-medium hover:bg-emerald-700 transition-colors">
                      📅 ჯავშნა
                    </Link>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 relative overflow-hidden">
                  <div ref={chatScrollRef} onScroll={handleScroll}
                    className="h-full overflow-y-auto p-4 flex flex-col">
                    {messages.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2 py-12">
                        <p className="text-3xl">👋</p>
                        <p className="text-sm">საუბარი ჯერ არ დაწყებულა</p>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        {messages.map((msg, idx) => {
                          const mine       = msg.sender_id === currentUser?.id;
                          const first      = isFirstInGroup(idx);
                          const last       = isLastInGroup(idx);
                          const isDeleted  = msg.content === "[DELETED]";
                          const isMedia    = msg.content.includes("[IMAGE]") ||
                                            msg.content.includes("[FILE]") ||
                                            msg.content.includes("[VIDEO]");
                          const showDate   = shouldShowDate(idx);
                          const isHovered  = hoveredMsgId === msg.id;

                          let bubbleRound = "rounded-2xl";
                          if (!isMedia && !isDeleted) {
                            if (mine) {
                              bubbleRound = `rounded-2xl ${first ? "rounded-tr-md" : ""} ${last ? "rounded-br-md" : "rounded-r-md"}`;
                            } else {
                              bubbleRound = `rounded-2xl ${first ? "rounded-tl-md" : ""} ${last ? "rounded-bl-md" : "rounded-l-md"}`;
                            }
                          }

                          return (
                            <div key={msg.id}>
                              {showDate && (
                                <div className="flex items-center gap-3 my-4">
                                  <div className="flex-1 h-px bg-gray-100" />
                                  <span className="text-xs text-gray-400 shrink-0">
                                    {dateSeparatorLabel(msg.created_at)}
                                  </span>
                                  <div className="flex-1 h-px bg-gray-100" />
                                </div>
                              )}

                              <div
                                className={`flex ${mine ? "justify-end" : "justify-start"} items-end gap-1 ${first ? "mt-3" : "mt-0.5"}`}
                                onMouseEnter={() => setHoveredMsgId(msg.id)}
                                onMouseLeave={() => setHoveredMsgId(null)}
                              >
                                {/* Other's avatar */}
                                {!mine && (
                                  <div className={`w-7 h-7 rounded-full shrink-0 text-xs font-bold flex items-center justify-center ${
                                    last ? "bg-emerald-100 text-emerald-800" : "opacity-0"
                                  }`}>
                                    {last ? activeChat.name?.[0] : ""}
                                  </div>
                                )}

                                {/* Action buttons — mine side (left of bubble) */}
                                {mine && !isDeleted && isHovered && (
                                  <div className="flex items-center gap-0.5 shrink-0 mb-5">
                                    <button onClick={() => startReply(msg)} title="↩ Reply" className={BTN_ACTION}>↩</button>
                                    <button onClick={() => startForward(msg)} title="↪ Forward"
                                      className="w-6 h-6 bg-white border border-gray-200 rounded-full shadow-sm flex items-center justify-center text-[11px] hover:border-blue-300 hover:bg-blue-50 transition-all shrink-0">
                                      ↪
                                    </button>
                                    <button
                                      onClick={() => deleteMessage(msg.id)}
                                      disabled={deletingId === msg.id}
                                      title="წაშლა"
                                      className="w-6 h-6 bg-white border border-gray-200 rounded-full shadow-sm flex items-center justify-center text-xs hover:bg-red-50 hover:border-red-200 transition-all disabled:opacity-50 shrink-0">
                                      {deletingId === msg.id ? "⋯" : "🗑"}
                                    </button>
                                  </div>
                                )}

                                <div className="flex flex-col max-w-xs">
                                  <div className={`${
                                    isMedia || isDeleted ? "" :
                                    mine
                                      ? `bg-emerald-600 text-white px-4 py-2.5 ${bubbleRound}`
                                      : `bg-gray-100 text-gray-800 px-4 py-2.5 ${bubbleRound}`
                                  }`}>
                                    {renderContent(msg.content, mine)}

                                    {!isMedia && (
                                      <p className={`text-[11px] mt-0.5 ${
                                        isDeleted ? "text-gray-400" :
                                        mine ? "text-emerald-200" : "text-gray-400"
                                      }`}>
                                        {formatTime(msg.created_at)}
                                      </p>
                                    )}
                                    {isMedia && (
                                      <p className="text-[11px] text-gray-400 mt-0.5">
                                        {formatTime(msg.created_at)}
                                      </p>
                                    )}
                                  </div>

                                  {mine && idx === messages.length - 1 && (
                                    <p className="text-[11px] text-gray-400 mt-0.5 text-right">
                                      {msg.seen ? "✓✓ წაკითხული" : "✓ გაგზავნილი"}
                                    </p>
                                  )}
                                </div>

                                {/* Action buttons — other side (right of bubble) */}
                                {!mine && !isDeleted && isHovered && (
                                  <div className="flex items-center gap-0.5 shrink-0 mb-5">
                                    <button onClick={() => startReply(msg)} title="↩ Reply" className={BTN_ACTION}>↩</button>
                                    <button onClick={() => startForward(msg)} title="↪ Forward"
                                      className="w-6 h-6 bg-white border border-gray-200 rounded-full shadow-sm flex items-center justify-center text-[11px] hover:border-blue-300 hover:bg-blue-50 transition-all shrink-0">
                                      ↪
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Typing dots */}
                        {isPartnerTyping && (
                          <div className="flex justify-start mt-3">
                            <div className="w-7 h-7 rounded-full mr-2 self-end bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center shrink-0">
                              {activeChat.name?.[0]}
                            </div>
                            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1 items-center">
                              {[0, 150, 300].map(delay => (
                                <span key={delay}
                                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                                  style={{ animationDelay: `${delay}ms` }} />
                              ))}
                            </div>
                          </div>
                        )}

                        <div ref={bottomRef} />
                      </div>
                    )}
                  </div>

                  {/* Scroll-to-bottom button */}
                  {showScrollBtn && (
                    <button onClick={scrollToBottom}
                      className="absolute bottom-4 right-4 bg-white border border-gray-200 shadow-md rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-all z-10">
                      {newMsgCount > 0 ? (
                        <span className="text-xs font-bold text-emerald-600">{newMsgCount}</span>
                      ) : (
                        <span className="text-gray-500 text-sm">↓</span>
                      )}
                    </button>
                  )}
                </div>

                {/* Input */}
                <div className="p-4 border-t border-gray-100 shrink-0">
                  {/* Reply bar */}
                  {replyTo && (
                    <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-emerald-50 rounded-xl border border-emerald-200">
                      <div className="flex-1 border-l-2 border-emerald-500 pl-2 min-w-0">
                        <p className="text-[11px] font-semibold text-emerald-700">{replyTo.senderName}</p>
                        <p className="text-xs text-gray-500 truncate">{getReplyPreview(replyTo.content)}</p>
                      </div>
                      <button onClick={() => setReplyTo(null)}
                        className="text-gray-400 hover:text-gray-600 text-sm px-1 shrink-0">✕</button>
                    </div>
                  )}

                  {uploading && (
                    <div className="flex items-center gap-2 mb-2 text-xs text-gray-400">
                      <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      იტვირთება...
                    </div>
                  )}
                  <div className="flex gap-2 items-end">
                    {/* Emoji picker */}
                    <div className="relative shrink-0" ref={emojiRef}>
                      <button
                        onClick={() => setEmojiOpen(p => !p)}
                        className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-emerald-600 hover:border-emerald-300 transition-all"
                        title="Emoji">
                        😊
                      </button>
                      {emojiOpen && (
                        <div className="absolute bottom-12 left-0 bg-white border border-gray-200 rounded-2xl shadow-xl p-3 grid grid-cols-8 gap-1 z-20 w-72">
                          {EMOJIS.map(emoji => (
                            <button key={emoji} type="button"
                              onClick={() => {
                                setMessage(prev => prev + emoji);
                                setEmojiOpen(false);
                                textareaRef.current?.focus();
                              }}
                              className="text-xl hover:scale-125 transition-transform w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Photo */}
                    <label className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-emerald-600 hover:border-emerald-300 cursor-pointer transition-all" title="ფოტო">
                      🖼️
                      <input ref={imageInputRef} type="file" className="hidden"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        onChange={e => handleFileUpload(e, "image")} disabled={uploading} />
                    </label>

                    {/* Video */}
                    <label className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-emerald-600 hover:border-emerald-300 cursor-pointer transition-all" title="ვიდეო">
                      🎥
                      <input ref={videoInputRef} type="file" className="hidden"
                        accept="video/mp4,video/webm,video/ogg,video/quicktime"
                        onChange={e => handleFileUpload(e, "video")} disabled={uploading} />
                    </label>

                    {/* File */}
                    <label className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-emerald-600 hover:border-emerald-300 cursor-pointer transition-all" title="ფაილი">
                      📎
                      <input ref={fileInputRef} type="file" className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
                        onChange={e => handleFileUpload(e, "file")} disabled={uploading} />
                    </label>

                    {/* Textarea */}
                    <textarea
                      ref={textareaRef}
                      rows={1}
                      placeholder="ჩაწერეთ შეტყობინება..."
                      value={message}
                      onChange={e => { handleTyping(e.target.value); autoResize(e.target); }}
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      className="input flex-1 resize-none overflow-hidden leading-relaxed py-2.5"
                      style={{ minHeight: "42px", maxHeight: "120px" }}
                      disabled={uploading}
                    />

                    <button onClick={handleSend}
                      disabled={!message.trim() || uploading}
                      className="btn-primary shrink-0 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                      style={{ height: "42px", width: "42px", padding: 0 }}>
                      ➤
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-300 mt-1.5">
                    Enter = გაგზავნა &nbsp;·&nbsp; Shift+Enter = ახალი ხაზი
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
                <p className="text-4xl">💬</p>
                <p className="text-sm">აირჩიეთ საუბარი</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <MessagesContent />
    </Suspense>
  );
}
