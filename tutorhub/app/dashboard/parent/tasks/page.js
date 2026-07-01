"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardSidebar from "@/components/DashboardSidebar";
import { createClient } from "@/lib/supabase";

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

export default function ParentTasksPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }
      const uid = session.user.id;
      supabase.from("profiles").select("full_name").eq("id", uid).single()
        .then(({ data }) => { if (data?.full_name) setUserName(data.full_name); });

      const { data: childRows } = await supabase
        .from("parent_children")
        .select("profiles!child_id(id, full_name, avatar_url)")
        .eq("parent_id", uid);

      const childProfiles = (childRows || []).map(r => r.profiles).filter(Boolean);
      setChildren(childProfiles);
      if (childProfiles.length > 0) setSelectedChildId(childProfiles[0].id);

      const res = await fetch("/api/assignments");
      if (res.ok) setAssignments(await res.json());

      setLoading(false);
    }
    init();
  }, []);

  const selectedChild = children.find(c => c.id === selectedChildId);
  const childAssignments = assignments
    .filter(a => a.student_id === selectedChildId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const stats = {
    new: childAssignments.filter(a => getStatus(a) === "new").length,
    submitted: childAssignments.filter(a => getStatus(a) === "submitted").length,
    reviewed: childAssignments.filter(a => getStatus(a) === "reviewed").length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <DashboardSidebar role="parent" userName={userName} />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <DashboardSidebar role="parent" userName={userName} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">📝 შვილების დავალებები</h1>
            <p className="text-sm text-gray-500 mt-1">მასწავლებლის გამოგზავნილი სამუშაოები</p>
          </div>

          {children.length === 0 ? (
            <div className="card p-14 text-center">
              <div className="text-5xl mb-4">👨‍👩‍👧</div>
              <p className="text-gray-500 font-medium">შვილები ჯერ არ გყავთ დამატებული</p>
              <p className="text-sm text-gray-400 mt-1">
                გადადით{" "}
                <a href="/dashboard/parent/children" className="text-amber-600 underline">შვილების გვერდზე</a>
                {" "}დასამატებლად
              </p>
            </div>
          ) : (
            <>
              {/* Child selector tabs */}
              <div className="flex gap-2 mb-6 flex-wrap">
                {children.map(child => (
                  <button
                    key={child.id}
                    onClick={() => setSelectedChildId(child.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
                      selectedChildId === child.id
                        ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                        : "bg-white text-gray-700 border-gray-200 hover:border-amber-300"
                    }`}
                  >
                    {child.avatar_url ? (
                      <img src={child.avatar_url} className="w-6 h-6 rounded-full object-cover" alt="" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-xs font-bold">
                        {getInitials(child.full_name)}
                      </div>
                    )}
                    {child.full_name}
                  </button>
                ))}
              </div>

              {/* Stats row */}
              {childAssignments.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[
                    { label: "🔴 ახალი", count: stats.new, color: "bg-red-50 text-red-700 border-red-100" },
                    { label: "🟡 ჩაბარებული", count: stats.submitted, color: "bg-amber-50 text-amber-700 border-amber-100" },
                    { label: "✅ შემოწმებული", count: stats.reviewed, color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
                  ].map(s => (
                    <div key={s.label} className={`rounded-xl p-3 border text-center ${s.color}`}>
                      <p className="text-2xl font-bold">{s.count}</p>
                      <p className="text-xs mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Assignments */}
              {childAssignments.length === 0 ? (
                <div className="card p-12 text-center">
                  <div className="text-5xl mb-4">📭</div>
                  <p className="text-gray-400 text-sm">
                    {selectedChild?.full_name}-ს ჯერ არ აქვს დავალებები
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {childAssignments.map(a => {
                    const status = getStatus(a);
                    const tutor = a.tutor;
                    const subs = [...(a.assignment_submissions || [])].sort(
                      (x, y) => new Date(y.submitted_at) - new Date(x.submitted_at)
                    );
                    const isOpen = !!expanded[a.id];

                    return (
                      <div key={a.id} className="card overflow-hidden">
                        <button
                          onClick={() => setExpanded(e => ({ ...e, [a.id]: !e[a.id] }))}
                          className="w-full flex items-start gap-4 p-5 text-left hover:bg-gray-50/50 transition-colors"
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            {tutor?.avatar_url ? (
                              <img src={tutor.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-xs font-bold">
                                {getInitials(tutor?.full_name)}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-800 leading-tight">{a.title}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  მასწავლებელი:{" "}
                                  <Link href={`/tutors/${a.tutor_id}`} className="hover:underline hover:text-emerald-600">
                                    {tutor?.full_name || "—"}
                                  </Link>
                                </p>
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

                        {isOpen && (
                          <div className="border-t border-gray-100 p-5 space-y-4 bg-gray-50/30">
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
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">მასწავლებლის ფაილი</p>
                                <a
                                  href={a.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:border-amber-300 rounded-xl text-sm text-gray-700 transition-colors"
                                >
                                  {fileIcon(a.file_name)} {a.file_name || "ფაილი"}
                                </a>
                              </div>
                            )}

                            {/* Submissions */}
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
                                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <span className="text-xs font-semibold text-gray-600">ჩაბარება {subs.length - idx}</span>
                                        <span className="text-xs text-gray-400">
                                          {new Date(sub.submitted_at).toLocaleString("ka-GE")}
                                        </span>
                                        {sub.status === "reviewed" && (
                                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                                            ✅ შეფასებული
                                          </span>
                                        )}
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
                                          <p className="text-xs font-semibold text-emerald-700 mb-1">
                                            ✅ მასწავლებლის კომენტარი:
                                          </p>
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
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
