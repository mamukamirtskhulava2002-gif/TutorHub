"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import DashboardSidebar from "@/components/DashboardSidebar";
import { calcWeightedRating } from "@/lib/reviewUtils";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("ka-GE", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function Stars({ rating, size = "text-sm" }) {
  return (
    <div className="flex gap-0.5">
      {Array(5).fill(0).map((_, i) => (
        <span key={i} className={`${size} ${i < rating ? "text-amber-400" : "text-gray-200"}`}>★</span>
      ))}
    </div>
  );
}

// ─── Appeal Modal ─────────────────────────────────────────────────────────────
function AppealModal({ review, onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  const [preset, setPreset]  = useState("");
  const PRESETS = [
    "სტუდენტი საერთოდ არ დამსწრებია გაკვეთილს",
    "კომენტარი შეიცავს ყალბ ინფორმაციას",
    "კომენტარი პირადი შეუსაბამო სიტყვებია",
    "ტექნიკური პრობლემა იყო, ჩემი ბრალი არ არის",
  ];
  const full = preset === "other" ? reason : (preset || reason);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
        <h3 className="font-bold text-gray-900 text-lg mb-1">⚖️ შეფასების გასაჩივრება</h3>
        <p className="text-sm text-gray-500 mb-4">
          ადმინისტრატორი განიხილავს მოთხოვნას და მოგწერთ პასუხს.
        </p>

        {/* Stars reminder */}
        <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
          <Stars rating={review.rating} />
          <p className="text-sm text-gray-500 line-clamp-2">{review.comment || "(კომენტარი არ არის)"}</p>
        </div>

        {/* Preset reasons */}
        <p className="text-xs font-semibold text-gray-500 mb-2">გასაჩივრების მიზეზი</p>
        <div className="space-y-2 mb-3">
          {PRESETS.map(p => (
            <button key={p} onClick={() => { setPreset(p); setReason(""); }}
              className={`w-full text-left text-sm px-3 py-2.5 rounded-xl border transition-all ${
                preset === p
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}>
              {preset === p ? "✓ " : ""}{p}
            </button>
          ))}
          <button onClick={() => setPreset("other")}
            className={`w-full text-left text-sm px-3 py-2.5 rounded-xl border transition-all ${
              preset === "other"
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-gray-200 text-gray-600 hover:border-gray-300"
            }`}>
            {preset === "other" ? "✓ " : ""}სხვა მიზეზი...
          </button>
        </div>

        {preset === "other" && (
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="აღწერეთ მიზეზი..."
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
          />
        )}

        <div className="flex gap-2 mt-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm">
            გაუქმება
          </button>
          <button
            onClick={() => full.trim() && onSubmit(full)}
            disabled={!full.trim()}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-40">
            გაგზავნა ⚖️
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function TutorReviewsPage() {
  const router = useRouter();
  const [tutorId, setTutorId]     = useState(null);
  const [tutorName, setTutorName] = useState("მასწავლებელი");
  const [reviews, setReviews]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState("all"); // all | no_reply | appealed
  const [toast, setToast]         = useState(null);

  // per-review UI state
  const [replyOpen, setReplyOpen]   = useState({}); // { [id]: bool }
  const [replyText, setReplyText]   = useState({}); // { [id]: string }
  const [savingReply, setSavingReply] = useState(null);
  const [appealModal, setAppealModal] = useState(null); // review object
  const [submittingAppeal, setSubmittingAppeal] = useState(false);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/auth"); return; }
      const user = session.user;
      setTutorId(user.id);

      const { data: profile } = await supabase
        .from("profiles").select("full_name, role").eq("id", user.id).single();
      if (profile?.role !== "tutor") { router.push("/dashboard"); return; }
      if (profile?.full_name) setTutorName(profile.full_name);

      // mark all as seen — fire and forget (badge clears in sidebar)
      supabase.from("reviews")
        .update({ seen_by_tutor: true })
        .eq("tutor_id", user.id)
        .eq("seen_by_tutor", false)
        .then(() => {});

      // 1st attempt: with moderation columns (requires SQL migration)
      let { data, error: e1 } = await supabase
        .from("reviews")
        .select(`
          id, student_id, rating, comment, created_at,
          tutor_reply, is_appealed, appeal_reason, appeal_status, hidden, is_reported,
          profiles!student_id(full_name, id)
        `)
        .eq("tutor_id", user.id)
        .order("created_at", { ascending: false });

      // 2nd attempt: no moderation columns, but still with student name
      if (e1) {
        const { data: d2, error: e2 } = await supabase
          .from("reviews")
          .select("id, student_id, rating, comment, created_at, profiles!student_id(full_name, id)")
          .eq("tutor_id", user.id)
          .order("created_at", { ascending: false });

        // 3rd attempt: bare minimum — no join at all, but student_id is enough for notifications
        if (e2) {
          const { data: d3 } = await supabase
            .from("reviews")
            .select("id, student_id, rating, comment, created_at")
            .eq("tutor_id", user.id)
            .order("created_at", { ascending: false });
          data = (d3 || []).map(r => ({ ...r, profiles: null }));
        } else {
          data = d2 || [];
        }

        data = data.map(r => ({
          ...r,
          tutor_reply: null, is_appealed: false,
          appeal_reason: null, appeal_status: "none",
          hidden: false, is_reported: false,
        }));
      }

      setReviews(data || []);
      setLoading(false);
    }
    fetchData();
  }, [router]);

  // ─── Save reply ───────────────────────────────────────────────────────────
  async function saveReply(reviewId) {
    const text = (replyText[reviewId] || "").trim();
    if (!text) return;
    setSavingReply(reviewId);
    const supabase = createClient();
    const { error } = await supabase.from("reviews")
      .update({ tutor_reply: text }).eq("id", reviewId);
    if (error) {
      showToast("პასუხის შენახვა ვერ მოხერხდა", "error");
    } else {
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, tutor_reply: text } : r));
      setReplyOpen(prev => ({ ...prev, [reviewId]: false }));
      showToast("პასუხი გამოქვეყნდა!");

      // notify the student
      const review = reviews.find(r => r.id === reviewId);
      const studentId = review?.student_id || review?.profiles?.id;
      console.log("[saveReply] studentId:", studentId, "review:", review);
      if (studentId) {
        const { error: notifErr } = await supabase.from("notifications").insert({
          user_id: studentId,
          type: "booking",
          title: "მასწავლებელმა შეფასებაზე უპასუხა 💬",
          body: `${tutorName}: "${text.slice(0, 80)}${text.length > 80 ? "…" : ""}"`,
          link: "/dashboard/student/lessons?tab=past",
          is_read: false,
        });
        console.log("[saveReply] notif insert error:", notifErr);
      } else {
        console.warn("[saveReply] studentId is null — notification not sent");
      }
    }
    setSavingReply(null);
  }

  // ─── Delete reply ─────────────────────────────────────────────────────────
  async function deleteReply(reviewId) {
    const supabase = createClient();
    await supabase.from("reviews").update({ tutor_reply: null }).eq("id", reviewId);
    setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, tutor_reply: null } : r));
    setReplyText(prev => ({ ...prev, [reviewId]: "" }));
    showToast("პასუხი წაიშალა");
  }

  // ─── Submit appeal ────────────────────────────────────────────────────────
  async function submitAppeal(reviewId, reason) {
    setSubmittingAppeal(true);
    const supabase = createClient();
    const { error } = await supabase.from("reviews").update({
      is_appealed: true,
      appeal_reason: reason,
      appeal_status: "pending",
    }).eq("id", reviewId);
    if (error) {
      showToast("გასაჩივრება ვერ მოხერხდა", "error");
    } else {
      setReviews(prev => prev.map(r =>
        r.id === reviewId ? { ...r, is_appealed: true, appeal_reason: reason, appeal_status: "pending" } : r
      ));
      setAppealModal(null);
      showToast("გასაჩივრება გაიგზავნა! ადმინი განიხილავს.");
    }
    setSubmittingAppeal(false);
  }

  // ─── Report review ────────────────────────────────────────────────────────
  async function reportReview(reviewId) {
    const supabase = createClient();
    const { error } = await supabase.from("reviews").update({
      is_reported: true,
      report_reason: "შეიცავს შეუფერებელ/შეურაცხმყოფელ სიტყვებს (მასწ. შეტყობინება)",
    }).eq("id", reviewId);
    if (error) {
      showToast("შეტყობინება ვერ გაიგზავნა", "error");
    } else {
      setReviews(prev => prev.map(r =>
        r.id === reviewId ? { ...r, is_reported: true } : r
      ));
      showToast("🚩 შეტყობინება გაიგზავნა — ადმინი განიხილავს");
    }
  }

  // ─── computed ─────────────────────────────────────────────────────────────
  const visibleReviews = reviews.filter(r => !r.hidden);
  const ratingData = calcWeightedRating(visibleReviews);
  const breakdown = [5,4,3,2,1].map(star => visibleReviews.filter(r => r.rating === star).length);
  const pendingAppeal = reviews.filter(r => r.is_appealed && r.appeal_status === "pending").length;
  const noReplyCount  = visibleReviews.filter(r => !r.tutor_reply).length;

  const tabFiltered = visibleReviews.filter(r => {
    if (tab === "no_reply") return !r.tutor_reply;
    if (tab === "appealed") return r.is_appealed;
    return true;
  });

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 grid md:grid-cols-[240px_1fr]">
      <DashboardSidebar role="tutor" userName={tutorName} />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-sm px-5 py-3 rounded-2xl shadow-lg border font-medium ${
          toast.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Appeal modal */}
      {appealModal && (
        <AppealModal
          review={appealModal}
          onClose={() => setAppealModal(null)}
          onSubmit={reason => submitAppeal(appealModal.id, reason)}
        />
      )}

      <main className="p-6 md:p-8 max-w-3xl">
        <h1 className="text-2xl font-black text-gray-900 mb-6">⭐ შეფასებები</h1>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* ─── Stats card ─── */}
            <div className="card p-6 mb-6">
              <div className="flex items-start gap-8 flex-wrap">
                {/* Rating numbers */}
                <div className="text-center min-w-[100px]">
                  <p className="text-5xl font-black text-gray-900">{ratingData.weighted}</p>
                  <Stars rating={Math.round(ratingData.weighted)} size="text-xl" />
                  <p className="text-xs text-gray-400 mt-1">
                    {visibleReviews.length} შეფასება
                  </p>
                  {ratingData.weighted !== ratingData.simple && (
                    <div className="mt-2 text-[11px] text-gray-400 bg-gray-50 rounded-xl px-2 py-1">
                      <p>შეწონილი ★ {ratingData.weighted}</p>
                      <p>მარტივი ★ {ratingData.simple}</p>
                      <p className="text-emerald-600">{ratingData.recentCount} ბოლო 3 თვეში</p>
                    </div>
                  )}
                </div>

                {/* Breakdown */}
                <div className="flex-1 space-y-2 min-w-[160px]">
                  {[5,4,3,2,1].map((star, i) => {
                    const count = breakdown[i];
                    const pct = visibleReviews.length > 0 ? (count / visibleReviews.length) * 100 : 0;
                    return (
                      <div key={star} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-3">{star}</span>
                        <span className="text-amber-400 text-xs">★</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div className="bg-amber-400 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 w-4">{count}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Tips */}
                <div className="space-y-2 text-xs text-gray-500 min-w-[140px]">
                  <div className="bg-blue-50 rounded-xl px-3 py-2">
                    <p className="font-medium text-blue-700 mb-0.5">💡 შეწონილი რეიტინგი</p>
                    <p>ბოლო 3 თვე = 70%</p>
                    <p>ძველი = 30%</p>
                  </div>
                  {noReplyCount > 0 && (
                    <div className="bg-amber-50 rounded-xl px-3 py-2">
                      <p className="font-medium text-amber-700">{noReplyCount} უპასუხო</p>
                      <p className="text-amber-600">პასუხი ამაღლებს ნდობას</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ─── Tabs ─── */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-5 flex-wrap">
              {[
                { key: "all",       label: `ყველა (${visibleReviews.length})` },
                { key: "no_reply",  label: `უპასუხო (${noReplyCount})` },
                { key: "appealed",  label: `გასაჩივ. (${reviews.filter(r=>r.is_appealed).length})` },
              ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all relative ${
                    tab === t.key
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}>
                  {t.label}
                  {t.key === "appealed" && pendingAppeal > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {pendingAppeal}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ─── Review list ─── */}
            {tabFiltered.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-4xl mb-3">⭐</p>
                <p className="text-gray-400 text-sm">
                  {tab === "no_reply" ? "ყველა შეფასებას პასუხი გაქვს!" :
                   tab === "appealed" ? "გასაჩივრებები არ არის" :
                   "შეფასებები ჯერ არ არის"}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {tabFiltered.map(review => {
                  const isReplyOpen = replyOpen[review.id];
                  const draft = replyText[review.id] ?? (review.tutor_reply || "");
                  const canAppeal = !review.is_appealed && review.rating <= 2;
                  const appealStatusLabel = {
                    pending:  "⏳ განიხილება",
                    approved: "✅ მოწ. (დამალული)",
                    rejected: "❌ უარყოფილი",
                  }[review.appeal_status] || null;

                  return (
                    <div key={review.id} className={`card p-5 ${
                      review.is_reported ? "border-red-200 bg-red-50/30" :
                      review.appeal_status === "pending" ? "border-amber-200 bg-amber-50/20" : ""
                    }`}>
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0">
                            {review.profiles?.full_name?.[0] || "?"}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{review.profiles?.full_name || "სტუდენტი"}</p>
                            <p className="text-xs text-gray-400">{formatDate(review.created_at)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Stars rating={review.rating} />
                          {review.is_reported && (
                            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">🚩 შეტყობ.</span>
                          )}
                          {appealStatusLabel && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                              {appealStatusLabel}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Comment */}
                      {review.comment && (
                        <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 px-4 py-3 rounded-xl mb-3">
                          {review.comment}
                        </p>
                      )}

                      {/* Tutor reply (published) */}
                      {review.tutor_reply && !isReplyOpen && (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 mb-3">
                          <p className="text-xs font-semibold text-emerald-700 mb-1">↩ შენი პასუხი</p>
                          <p className="text-sm text-gray-700 leading-relaxed">{review.tutor_reply}</p>
                          <div className="flex gap-3 mt-2">
                            <button
                              onClick={() => {
                                setReplyText(p => ({ ...p, [review.id]: review.tutor_reply }));
                                setReplyOpen(p => ({ ...p, [review.id]: true }));
                              }}
                              className="text-xs text-emerald-600 hover:underline">
                              ✏️ შეცვლა
                            </button>
                            <button onClick={() => deleteReply(review.id)}
                              className="text-xs text-red-400 hover:underline">
                              წაშლა
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Reply editor */}
                      {isReplyOpen && (
                        <div className="mb-3">
                          <textarea
                            rows={3}
                            value={draft}
                            onChange={e => setReplyText(p => ({ ...p, [review.id]: e.target.value }))}
                            placeholder="დაწერე პასუხი... (სტუდენტებს საჯაროდ დაენახება)"
                            className="w-full border border-emerald-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => setReplyOpen(p => ({ ...p, [review.id]: false }))}
                              className="text-xs px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500">
                              გაუქმება
                            </button>
                            <button
                              onClick={() => saveReply(review.id)}
                              disabled={!draft.trim() || savingReply === review.id}
                              className="text-xs px-4 py-1.5 rounded-xl bg-emerald-600 text-white font-medium disabled:opacity-40">
                              {savingReply === review.id ? "ინახება..." : "გამოქვეყნება"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Appeal reason (if appealed) */}
                      {review.is_appealed && review.appeal_reason && (
                        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 mb-3 text-xs text-amber-800">
                          <span className="font-semibold">⚖️ გასაჩივრების მიზეზი: </span>
                          {review.appeal_reason}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2 flex-wrap">
                        {!isReplyOpen && !review.tutor_reply && (
                          <button
                            onClick={() => {
                              setReplyText(p => ({ ...p, [review.id]: "" }));
                              setReplyOpen(p => ({ ...p, [review.id]: true }));
                            }}
                            className="text-xs px-3 py-1.5 rounded-xl border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-colors">
                            ↩ პასუხი
                          </button>
                        )}
                        {canAppeal && (
                          <button
                            onClick={() => setAppealModal(review)}
                            className="text-xs px-3 py-1.5 rounded-xl border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors">
                            ⚖️ გასაჩივრება
                          </button>
                        )}
                        {!review.is_reported ? (
                          <button
                            onClick={() => reportReview(review.id)}
                            className="text-xs px-3 py-1.5 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                            🚩 კომენტარის გასაჩივრება
                          </button>
                        ) : (
                          <span className="text-xs text-red-400 font-medium self-center">🚩 შეტყობ. გაიგზავნა</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
