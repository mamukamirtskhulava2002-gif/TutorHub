"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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

function assignmentStatus(a) {
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

function toDatetimeLocal(iso) {
  if (!iso) return "";
  return iso.slice(0, 16);
}

export default function TutorTasksPage() {
  const router = useRouter();
  const supabase = createClient();
  const createFileRef = useRef();
  const editFileRef = useRef();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState("");
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [expanded, setExpanded] = useState({});

  // Create
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", deadline: "" });
  const [formFile, setFormFile] = useState(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", deadline: "" });
  const [editFile, setEditFile] = useState(null);
  const [editRemoveFile, setEditRemoveFile] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Delete
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Feedback
  const [feedbackText, setFeedbackText] = useState({});
  const [feedbackSaving, setFeedbackSaving] = useState({});

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }
      const uid = session.user.id;
      setUserId(uid);

      const { data: profile } = await supabase
        .from("profiles").select("role, full_name").eq("id", uid).single();

      if (profile?.role !== "tutor") {
        router.push(`/dashboard/${profile?.role || ""}`);
        return;
      }
      if (profile?.full_name) setUserName(profile.full_name);

      const [bookingRes, assignRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("student_id, profiles!student_id(id, full_name, avatar_url)")
          .eq("tutor_id", uid)
          .in("status", ["confirmed", "completed"]),
        fetch("/api/assignments"),
      ]);

      const seen = new Set();
      const uniq = [];
      for (const b of (bookingRes.data || [])) {
        if (b.profiles && !seen.has(b.student_id)) {
          seen.add(b.student_id);
          uniq.push(b.profiles);
        }
      }

      let aData = [];
      if (assignRes.ok) {
        aData = await assignRes.json();
        setAssignments(aData);
        for (const a of aData) {
          if (a.profiles && !seen.has(a.student_id)) {
            seen.add(a.student_id);
            uniq.push(a.profiles);
          }
        }
      }
      setStudents(uniq);
      setLoading(false);
    }
    init();
  }, []);

  async function refreshAssignments() {
    const res = await fetch("/api/assignments");
    if (res.ok) setAssignments(await res.json());
  }

  async function uploadFile(file) {
    const err = validateFile(file);
    if (err) return { error: err };
    const ext = file.name.split(".").pop();
    const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("assignment-files")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (upErr) return { error: upErr.message };
    const { data: { publicUrl } } = supabase.storage.from("assignment-files").getPublicUrl(path);
    return { url: publicUrl, name: file.name };
  }

  // ── Create ──────────────────────────────────────────────────────────────────
  async function handleCreate(e) {
    e.preventDefault();
    if (!selectedId || !form.title.trim()) { setFormError("სათაური სავალდებულოა"); return; }
    setFormError("");
    setSaving(true);

    let fileUrl = null;
    let fileName = null;
    if (formFile) {
      const result = await uploadFile(formFile);
      if (result.error) { setFormError(result.error); setSaving(false); return; }
      fileUrl = result.url;
      fileName = result.name;
    }

    const res = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: selectedId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        deadline: form.deadline || null,
        fileUrl,
        fileName,
      }),
    });
    const json = await res.json();
    if (!res.ok) { setFormError(json.error || "შეცდომა"); setSaving(false); return; }

    await refreshAssignments();
    setForm({ title: "", description: "", deadline: "" });
    setFormFile(null);
    if (createFileRef.current) createFileRef.current.value = "";
    setShowForm(false);
    setSaving(false);
  }

  // ── Start editing ────────────────────────────────────────────────────────────
  function startEdit(a) {
    setEditingId(a.id);
    setEditForm({
      title: a.title,
      description: a.description || "",
      deadline: toDatetimeLocal(a.deadline),
    });
    setEditFile(null);
    setEditRemoveFile(false);
    setEditError("");
    setExpanded(e => ({ ...e, [a.id]: false }));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditFile(null);
    setEditRemoveFile(false);
    setEditError("");
  }

  // ── Save edit ────────────────────────────────────────────────────────────────
  async function handleEdit(e, assignment) {
    e.preventDefault();
    if (!editForm.title.trim()) { setEditError("სათაური სავალდებულოა"); return; }
    setEditError("");
    setEditSaving(true);

    let fileUrl = undefined;
    let fileName = undefined;

    if (editRemoveFile) {
      fileUrl = null;
      fileName = null;
    } else if (editFile) {
      const result = await uploadFile(editFile);
      if (result.error) { setEditError(result.error); setEditSaving(false); return; }
      fileUrl = result.url;
      fileName = result.name;
    }

    const body = {
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
      deadline: editForm.deadline || null,
    };
    if (fileUrl !== undefined) { body.fileUrl = fileUrl; body.fileName = fileName; }

    const res = await fetch(`/api/assignments/${assignment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) { setEditError(json.error || "შეცდომა"); setEditSaving(false); return; }

    await refreshAssignments();
    setEditingId(null);
    setEditFile(null);
    setEditSaving(false);
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  async function handleDelete(assignmentId) {
    setDeleting(true);
    const res = await fetch(`/api/assignments/${assignmentId}`, { method: "DELETE" });
    if (res.ok) {
      await refreshAssignments();
      setDeleteConfirmId(null);
    }
    setDeleting(false);
  }

  // ── Feedback ─────────────────────────────────────────────────────────────────
  async function handleFeedback(assignmentId, submissionId) {
    const text = feedbackText[submissionId];
    if (!text?.trim()) return;
    setFeedbackSaving(s => ({ ...s, [submissionId]: true }));
    const res = await fetch(`/api/assignments/${assignmentId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, feedback: text.trim() }),
    });
    if (res.ok) {
      await refreshAssignments();
      setFeedbackText(t => { const n = { ...t }; delete n[submissionId]; return n; });
    }
    setFeedbackSaving(s => ({ ...s, [submissionId]: false }));
  }

  const selectedStudent = students.find(s => s.id === selectedId);
  const selectedStudentAssignments = assignments
    .filter(a => a.student_id === selectedId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <DashboardSidebar role="tutor" userName={userName} />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <DashboardSidebar role="tutor" userName={userName} />

      <main className="flex-1 flex flex-col lg:flex-row min-h-screen overflow-hidden">
        {/* ── Student list ── */}
        <aside className="w-full lg:w-72 bg-white border-b lg:border-b-0 lg:border-r border-gray-200 flex-shrink-0 flex flex-col">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-bold text-gray-800 text-lg">📝 Task Hub</h2>
            <p className="text-xs text-gray-400 mt-0.5">მოსწავლეები</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {students.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-gray-400">ჯერ არ გყავთ მოსწავლეები</p>
                <p className="text-xs text-gray-300 mt-1">ჯავშნის დადასტურების შემდეგ გამოჩნდებიან</p>
              </div>
            ) : (
              students.map(s => {
                const sAssigns = assignments.filter(a => a.student_id === s.id);
                const pendingReview = sAssigns.filter(a => assignmentStatus(a) === "submitted").length;
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedId(s.id); setShowForm(false); setEditingId(null); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left ${
                      selectedId === s.id ? "bg-emerald-50 border-r-2 border-emerald-500" : ""
                    }`}
                  >
                    {s.avatar_url ? (
                      <img src={s.avatar_url} className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt="" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {getInitials(s.full_name)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{s.full_name}</p>
                      <p className="text-xs text-gray-400">{sAssigns.length} დავალება</p>
                    </div>
                    {pendingReview > 0 && (
                      <span className="w-5 h-5 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center flex-shrink-0 font-medium">
                        {pendingReview}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="flex-1 overflow-y-auto">
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-8">
              <div className="text-7xl mb-5">📚</div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">მოსწავლე არ არის არჩეული</h3>
              <p className="text-gray-400 max-w-sm text-sm">
                მარცხნიდან მოსწავლეს მონიშნეთ დავალებების სანახავად ან ახლის დასამატებლად
              </p>
            </div>
          ) : (
            <div className="p-6 max-w-4xl">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{selectedStudent?.full_name}</h2>
                  <p className="text-sm text-gray-400 mt-0.5">{selectedStudentAssignments.length} დავალება სულ</p>
                </div>
                <button
                  onClick={() => { setShowForm(v => !v); setEditingId(null); }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                >
                  {showForm ? "✕ გაუქმება" : "+ ახალი დავალება"}
                </button>
              </div>

              {/* ── Create form ── */}
              {showForm && (
                <form onSubmit={handleCreate} className="card p-5 mb-6 border-2 border-emerald-200 bg-emerald-50/40">
                  <h3 className="font-semibold text-gray-800 mb-4">ახალი დავალება → {selectedStudent?.full_name}</h3>
                  {formError && <p className="text-sm text-red-600 mb-3 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{formError}</p>}
                  <div className="grid gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">სათაური *</label>
                      <input type="text" value={form.title}
                        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        placeholder="მაგ: მათემატიკა — სავარჯიშო #5" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ინსტრუქცია</label>
                      <textarea value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        rows={4} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                        placeholder="დეტალური ინსტრუქცია მოსწავლისთვის..." />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ბოლო ვადა</label>
                        <input type="datetime-local" value={form.deadline}
                          onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ფაილი <span className="text-gray-400 font-normal text-xs">(PDF/JPG/PNG/DOCX, max 20MB)</span>
                        </label>
                        <input ref={createFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.docx"
                          onChange={e => setFormFile(e.target.files[0] || null)} className="hidden" />
                        <button type="button" onClick={() => createFileRef.current?.click()}
                          className="w-full border border-dashed border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors text-left truncate">
                          {formFile ? `${fileIcon(formFile.name)} ${formFile.name}` : "📎 ფაილის არჩევა"}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-5">
                    <button type="submit" disabled={saving}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors">
                      {saving ? "იგზავნება..." : "📤 გაგზავნა"}
                    </button>
                    <button type="button" onClick={() => { setShowForm(false); setFormError(""); setFormFile(null); }}
                      className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors">
                      გაუქმება
                    </button>
                  </div>
                </form>
              )}

              {/* ── Assignments list ── */}
              {selectedStudentAssignments.length === 0 ? (
                <div className="card p-12 text-center">
                  <p className="text-gray-400 text-sm">ამ მოსწავლისთვის ჯერ არ გაქვთ დავალებები</p>
                  <p className="text-xs text-gray-300 mt-1">დააჭირეთ "+ ახალი დავალება" ზემოთ</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedStudentAssignments.map(a => {
                    const status = assignmentStatus(a);
                    const subs = [...(a.assignment_submissions || [])].sort(
                      (x, y) => new Date(y.submitted_at) - new Date(x.submitted_at)
                    );
                    const isOpen = !!expanded[a.id];
                    const isEditing = editingId === a.id;
                    const isDeleteConfirm = deleteConfirmId === a.id;

                    return (
                      <div key={a.id} className="card overflow-hidden">

                        {/* ── Edit form (inline) ── */}
                        {isEditing ? (
                          <form onSubmit={e => handleEdit(e, a)} className="p-5">
                            <h3 className="font-semibold text-gray-800 mb-4">✏️ დავალების რედაქტირება</h3>
                            {editError && <p className="text-sm text-red-600 mb-3 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{editError}</p>}
                            <div className="grid gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">სათაური *</label>
                                <input type="text" value={editForm.title}
                                  onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" required />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ინსტრუქცია</label>
                                <textarea value={editForm.description}
                                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                  rows={4} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">ბოლო ვადა</label>
                                  <input type="datetime-local" value={editForm.deadline}
                                    onChange={e => setEditForm(f => ({ ...f, deadline: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    ფაილი <span className="text-gray-400 font-normal text-xs">(PDF/JPG/PNG/DOCX, max 20MB)</span>
                                  </label>
                                  {a.file_url && !editRemoveFile && !editFile && (
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-sm text-gray-600 truncate">{fileIcon(a.file_name)} {a.file_name}</span>
                                      <button type="button" onClick={() => setEditRemoveFile(true)}
                                        className="text-xs text-red-500 hover:text-red-700 flex-shrink-0">✕ წაშლა</button>
                                    </div>
                                  )}
                                  {editRemoveFile && (
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-xs text-red-500">ფაილი წაიშლება</span>
                                      <button type="button" onClick={() => setEditRemoveFile(false)}
                                        className="text-xs text-gray-500 hover:text-gray-700">გაუქმება</button>
                                    </div>
                                  )}
                                  <input ref={editFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.docx"
                                    onChange={e => { setEditFile(e.target.files[0] || null); setEditRemoveFile(false); }} className="hidden" />
                                  <button type="button" onClick={() => editFileRef.current?.click()}
                                    className="w-full border border-dashed border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors text-left truncate">
                                    {editFile ? `${fileIcon(editFile.name)} ${editFile.name}` : "📎 ახალი ფაილის არჩევა"}
                                  </button>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-3 mt-5">
                              <button type="submit" disabled={editSaving}
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors">
                                {editSaving ? "ინახება..." : "💾 შენახვა"}
                              </button>
                              <button type="button" onClick={cancelEdit}
                                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors">
                                გაუქმება
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
                            {/* ── Card header ── */}
                            <div className="flex items-start gap-4 p-5">
                              <button
                                onClick={() => setExpanded(e => ({ ...e, [a.id]: !e[a.id] }))}
                                className="flex-1 min-w-0 text-left"
                              >
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-gray-800">{a.title}</span>
                                  <StatusBadge status={status} />
                                </div>
                                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                  {a.deadline && <DeadlineBadge deadline={a.deadline} />}
                                  <span className="text-xs text-gray-400">
                                    {new Date(a.created_at).toLocaleDateString("ka-GE")}
                                  </span>
                                  {subs.length > 0 && (
                                    <span className="text-xs text-gray-400">{subs.length} ჩაბარება</span>
                                  )}
                                </div>
                              </button>

                              {/* Action buttons */}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => startEdit(a)}
                                  className="px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                                  title="რედაქტირება"
                                >
                                  ✏️ რედ.
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(a.id)}
                                  className="px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                  title="წაშლა"
                                >
                                  🗑 წაშლა
                                </button>
                                <button
                                  onClick={() => setExpanded(e => ({ ...e, [a.id]: !e[a.id] }))}
                                  className="p-1.5 text-gray-300 hover:text-gray-500 transition-colors"
                                >
                                  {isOpen ? "▲" : "▼"}
                                </button>
                              </div>
                            </div>

                            {/* ── Delete confirmation ── */}
                            {isDeleteConfirm && (
                              <div className="mx-5 mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-4">
                                <p className="text-sm text-red-700 font-medium">
                                  დარწმუნებული ხართ? ყველა ჩაბარებაც წაიშლება.
                                </p>
                                <div className="flex gap-2 flex-shrink-0">
                                  <button
                                    onClick={() => handleDelete(a.id)}
                                    disabled={deleting}
                                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
                                  >
                                    {deleting ? "..." : "დიახ, წაშლა"}
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                                  >
                                    გაუქმება
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* ── Expanded body ── */}
                            {isOpen && (
                              <div className="border-t border-gray-100 p-5 space-y-4 bg-gray-50/30">
                                {a.description && (
                                  <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">ინსტრუქცია</p>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{a.description}</p>
                                  </div>
                                )}
                                {a.file_url && (
                                  <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">მიბმული ფაილი</p>
                                    <a href={a.file_url} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:border-emerald-300 rounded-xl text-sm text-gray-700 transition-colors">
                                      {fileIcon(a.file_name)} {a.file_name || "ფაილის ჩამოტვირთვა"}
                                    </a>
                                  </div>
                                )}

                                <div>
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                                    ჩაბარებები {subs.length > 0 ? `(${subs.length})` : ""}
                                  </p>
                                  {subs.length === 0 ? (
                                    <p className="text-sm text-gray-400 italic">ჯერ არ ჩაუბარებია</p>
                                  ) : (
                                    <div className="space-y-3">
                                      {subs.map((sub, idx) => (
                                        <div key={sub.id} className="bg-white rounded-xl p-4 border border-gray-200">
                                          <div className="flex items-center gap-2 mb-3 flex-wrap">
                                            <span className="text-xs font-semibold text-gray-600">ჩაბარება {subs.length - idx}</span>
                                            <span className="text-xs text-gray-400">{new Date(sub.submitted_at).toLocaleString("ka-GE")}</span>
                                            {sub.status === "reviewed" && (
                                              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">✅ შეფასებული</span>
                                            )}
                                          </div>
                                          {sub.comment && (
                                            <p className="text-sm text-gray-700 mb-3 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100 italic">"{sub.comment}"</p>
                                          )}
                                          {sub.file_url && (
                                            <a href={sub.file_url} target="_blank" rel="noopener noreferrer"
                                              className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-700 transition-colors mb-3">
                                              {fileIcon(sub.file_name)} {sub.file_name || "ფაილის ნახვა"}
                                            </a>
                                          )}
                                          {sub.feedback ? (
                                            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                                              <p className="text-xs font-semibold text-emerald-700 mb-1">თქვენი კომენტარი:</p>
                                              <p className="text-sm text-gray-700">{sub.feedback}</p>
                                              {sub.feedback_at && (
                                                <p className="text-xs text-gray-400 mt-1">{new Date(sub.feedback_at).toLocaleString("ka-GE")}</p>
                                              )}
                                            </div>
                                          ) : (
                                            <div className="space-y-2">
                                              <textarea
                                                value={feedbackText[sub.id] || ""}
                                                onChange={e => setFeedbackText(t => ({ ...t, [sub.id]: e.target.value }))}
                                                rows={3} placeholder="კომენტარი ჩაბარებულ სამუშაოზე..."
                                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
                                              <button
                                                onClick={() => handleFeedback(a.id, sub.id)}
                                                disabled={feedbackSaving[sub.id] || !feedbackText[sub.id]?.trim()}
                                                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors">
                                                {feedbackSaving[sub.id] ? "ინახება..." : "✅ შეფასება"}
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
