"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardSidebar from "@/components/DashboardSidebar";
import { createClient } from "@/lib/supabase";

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_SIZE = 20 * 1024 * 1024;

function validateFile(f) {
  if (f.size > MAX_SIZE) return "ფაილი 20 MB-ზე მეტია";
  if (!ALLOWED_TYPES.includes(f.type)) return "მხოლოდ PDF, JPG, PNG, DOCX ფაილებია დაშვებული";
  return null;
}

function fileIcon(name) {
  if (!name) return "📎";
  const ext = name.split(".").pop().toLowerCase();
  if (ext === "pdf") return "📄";
  if (["doc", "docx"].includes(ext)) return "📝";
  if (["jpg", "jpeg", "png"].includes(ext)) return "🖼️";
  return "📎";
}

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function getStatus(a) {
  const subs = a.assignment_submissions || [];
  if (!subs.length) return "new";
  const latest = [...subs].sort((x, y) => new Date(y.submitted_at) - new Date(x.submitted_at))[0];
  return latest.status;
}

function StatusBadge({ status }) {
  if (status === "new")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">🔴 ახალი</span>;
  if (status === "submitted")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">🟡 ჩაბარებული</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">✅ შემოწმებული</span>;
}

function DeadlineBadge({ deadline }) {
  if (!deadline) return null;
  const d = new Date(deadline);
  const diff = d - Date.now();
  const label = d.toLocaleDateString("ka-GE", { day: "numeric", month: "short", year: "numeric" });
  if (diff < 0) return <span className="text-xs text-red-600 font-medium">⏰ {label} (ვადა გასული)</span>;
  if (diff < 86400000 * 2) return <span className="text-xs text-amber-600 font-medium">⏰ {label}</span>;
  return <span className="text-xs text-gray-500">📅 {label}</span>;
}

const TABS = [
  { key: "all",       label: "ყველა" },
  { key: "new",       label: "🔴 ახალი" },
  { key: "submitted", label: "🟡 ჩაბარებული" },
  { key: "reviewed",  label: "✅ შემოწმებული" },
];

export default function StudentTasksPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState("");
  const [assignments, setAssignments] = useState([]);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState({});

  const [submitText, setSubmitText] = useState({});
  const [submitFile, setSubmitFile] = useState({});
  const [submitError, setSubmitError] = useState({});
  const [submitting, setSubmitting] = useState({});
  const fileRefs = useRef({});

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }
      const uid = session.user.id;
      setUserId(uid);

      const { data: profile } = await supabase
        .from("profiles").select("role, full_name").eq("id", uid).single();

      if (profile?.role !== "student") {
        router.push(`/dashboard/${profile?.role || ""}`);
        return;
      }
      if (profile?.full_name) setUserName(profile.full_name);

      await loadAssignments();
      setLoading(false);
    }
    init();
  }, []);

  async function loadAssignments() {
    const res = await fetch("/api/assignments");
    if (res.ok) setAssignments(await res.json());
  }

  const counts = {
    all: assignments.length,
    new: assignments.filter(a => getStatus(a) === "new").length,
    submitted: assignments.filter(a => getStatus(a) === "submitted").length,
    reviewed: assignments.filter(a => getStatus(a) === "reviewed").length,
  };

  const filtered = filter === "all"
    ? assignments
    : assignments.filter(a => getStatus(a) === filter);

  async function handleSubmit(e, assignmentId) {
    e.preventDefault();
    setSubmitError(err => ({ ...err, [assignmentId]: "" }));
    setSubmitting(s => ({ ...s, [assignmentId]: true }));

    let fileUrl = null;
    let fileName = null;
    const file = submitFile[assignmentId];

    if (file) {
      const err = validateFile(file);
      if (err) {
        setSubmitError(e => ({ ...e, [assignmentId]: err }));
        setSubmitting(s => ({ ...s, [assignmentId]: false }));
        return;
      }
      const ext = file.name.split(".").pop();
      const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("assignment-submissions")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) {
        setSubmitError(e => ({ ...e, [assignmentId]: upErr.message }));
        setSubmitting(s => ({ ...s, [assignmentId]: false }));
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("assignment-submissions").getPublicUrl(path);
      fileUrl = publicUrl;
      fileName = file.name;
    }

    const comment = submitText[assignmentId] || "";
    if (!fileUrl && !comment.trim()) {
      setSubmitError(e => ({ ...e, [assignmentId]: "ჩაწერეთ კომენტარი ან ატვირთეთ ფაილი" }));
      setSubmitting(s => ({ ...s, [assignmentId]: false }));
      return;
    }

    const res = await fetch(`/api/assignments/${assignmentId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileUrl, fileName, comment: comment.trim() }),
    });
    const json = await res.json();
    if (!res.ok) {
      setSubmitError(e => ({ ...e, [assignmentId]: json.error || "შეცდომა" }));
    } else {
      setSubmitText(t => { const n = { ...t }; delete n[assignmentId]; return n; });
      setSubmitFile(f => { const n = { ...f }; delete n[assignmentId]; return n; });
      if (fileRefs.current[assignmentId]) fileRefs.current[assignmentId].value = "";
      await loadAssignments();
    }
    setSubmitting(s => ({ ...s, [assignmentId]: false }));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <DashboardSidebar role="student" userName={userName} />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <DashboardSidebar role="student" userName={userName} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          {/* Page header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">📝 ჩემი დავალებები</h1>
            <p className="text-sm text-gray-500 mt-1">მასწავლებლის გამოგზავნილი სამუშაოები</p>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 bg-white rounded-2xl p-1 shadow-sm border border-gray-100 mb-6 overflow-x-auto">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`flex-1 min-w-max px-3 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  filter === t.key
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {t.label}
                {counts[t.key] > 0 && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    filter === t.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                  }`}>
                    {counts[t.key]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Assignments */}
          {filtered.length === 0 ? (
            <div className="card p-14 text-center">
              <div className="text-5xl mb-4">📭</div>
              <p className="text-gray-400 text-sm">
                {filter === "all" ? "ჯერ არ გაქვთ დავალებები" : "ამ სტატუსით დავალება არ არის"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map(a => {
                const status = getStatus(a);
                const tutor = a.profiles;
                const subs = [...(a.assignment_submissions || [])].sort(
                  (x, y) => new Date(y.submitted_at) - new Date(x.submitted_at)
                );
                const latestSub = subs[0];
                const canSubmit = status !== "reviewed";
                const isOpen = !!expanded[a.id];

                return (
                  <div key={a.id} className="card overflow-hidden">
                    {/* Card header */}
                    <button
                      onClick={() => setExpanded(e => ({ ...e, [a.id]: !e[a.id] }))}
                      className="w-full flex items-start gap-4 p-5 text-left hover:bg-gray-50/50 transition-colors"
                    >
                      {/* Tutor avatar */}
                      <div className="flex-shrink-0 mt-0.5">
                        {tutor?.avatar_url ? (
                          <img src={tutor.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-bold">
                            {getInitials(tutor?.full_name)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 leading-tight">{a.title}</p>
                            <Link href={`/tutor/${a.tutor_id}`} className="text-xs text-gray-400 mt-0.5 hover:underline hover:text-emerald-600">
                              {tutor?.full_name}
                            </Link>
                          </div>
                          <StatusBadge status={status} />
                        </div>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {a.deadline && <DeadlineBadge deadline={a.deadline} />}
                          <span className="text-xs text-gray-400">
                            {new Date(a.created_at).toLocaleDateString("ka-GE")}
                          </span>
                        </div>
                      </div>
                      <span className="text-gray-300 text-lg flex-shrink-0">{isOpen ? "▲" : "▼"}</span>
                    </button>

                    {/* Expanded */}
                    {isOpen && (
                      <div className="border-t border-gray-100 p-5 space-y-5 bg-gray-50/30">
                        {/* Description */}
                        {a.description && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">ინსტრუქცია</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-white rounded-xl p-4 border border-gray-100">
                              {a.description}
                            </p>
                          </div>
                        )}

                        {/* Tutor file */}
                        {a.file_url && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">მასალა</p>
                            <a
                              href={a.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:border-blue-300 rounded-xl text-sm text-gray-700 transition-colors"
                            >
                              {fileIcon(a.file_name)} {a.file_name || "ფაილის ჩამოტვირთვა"}
                            </a>
                          </div>
                        )}

                        {/* Previous submissions */}
                        {subs.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                              ჩემი ჩაბარებები ({subs.length})
                            </p>
                            <div className="space-y-3">
                              {subs.map((sub, idx) => (
                                <div key={sub.id} className="bg-white rounded-xl p-4 border border-gray-200">
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <span className="text-xs font-semibold text-gray-600">ჩაბარება {subs.length - idx}</span>
                                    <span className="text-xs text-gray-400">
                                      {new Date(sub.submitted_at).toLocaleString("ka-GE")}
                                    </span>
                                  </div>
                                  {sub.comment && (
                                    <p className="text-sm text-gray-700 italic mb-2">"{sub.comment}"</p>
                                  )}
                                  {sub.file_url && (
                                    <a
                                      href={sub.file_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                                    >
                                      {fileIcon(sub.file_name)} {sub.file_name || "ფაილი"}
                                    </a>
                                  )}
                                  {sub.feedback && (
                                    <div className="mt-3 bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                                      <p className="text-xs font-semibold text-emerald-700 mb-1">✅ მასწავლებლის კომენტარი:</p>
                                      <p className="text-sm text-gray-700">{sub.feedback}</p>
                                      {sub.feedback_at && (
                                        <p className="text-xs text-gray-400 mt-1">
                                          {new Date(sub.feedback_at).toLocaleString("ka-GE")}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Submit form */}
                        {canSubmit && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                              {latestSub ? "ხელახლა ჩაბარება" : "სამუშაოს ჩაბარება"}
                            </p>
                            <form
                              onSubmit={e => handleSubmit(e, a.id)}
                              className="bg-white rounded-xl p-4 border border-gray-200 space-y-3"
                            >
                              {submitError[a.id] && (
                                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                                  {submitError[a.id]}
                                </p>
                              )}
                              <textarea
                                value={submitText[a.id] || ""}
                                onChange={e => setSubmitText(t => ({ ...t, [a.id]: e.target.value }))}
                                rows={3}
                                placeholder="კომენტარი ან პასუხი..."
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                              />
                              <div className="flex items-center gap-3 flex-wrap">
                                <div>
                                  <input
                                    ref={el => { if (el) fileRefs.current[a.id] = el; }}
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png,.docx"
                                    onChange={e => setSubmitFile(f => ({ ...f, [a.id]: e.target.files[0] || null }))}
                                    className="hidden"
                                    id={`file-${a.id}`}
                                  />
                                  <label
                                    htmlFor={`file-${a.id}`}
                                    className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 border border-dashed border-gray-300 hover:border-blue-400 rounded-xl text-sm text-gray-500 hover:text-blue-600 transition-colors"
                                  >
                                    {submitFile[a.id]
                                      ? `${fileIcon(submitFile[a.id].name)} ${submitFile[a.id].name.slice(0, 25)}${submitFile[a.id].name.length > 25 ? "…" : ""}`
                                      : "📎 ფაილის არჩევა"}
                                  </label>
                                </div>
                                <button
                                  type="submit"
                                  disabled={submitting[a.id]}
                                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
                                >
                                  {submitting[a.id] ? "იგზავნება..." : "📤 ჩაბარება"}
                                </button>
                              </div>
                              <p className="text-xs text-gray-400">PDF, JPG, PNG, DOCX • მაქს. 20 MB</p>
                            </form>
                          </div>
                        )}

                        {status === "reviewed" && (
                          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 text-center">
                            <p className="text-sm font-medium text-emerald-700">✅ ეს დავალება შეფასებულია</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
