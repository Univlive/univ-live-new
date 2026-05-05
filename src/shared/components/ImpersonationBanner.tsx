export default function ImpersonationBanner() {
  const raw = sessionStorage.getItem("imp_session");
  if (!raw) return null;
  let name = "Unknown";
  try { name = JSON.parse(raw).name; } catch { /* ignore */ }

  function returnToAdmin() {
    sessionStorage.removeItem("imp_session");
    // Signal AuthProvider to switch back to primary auth before we navigate/close
    window.dispatchEvent(new Event("imp_session_changed"));
    if (window.opener && !window.opener.closed) {
      try { window.opener.focus(); } catch {}
    }
    // window.close() is blocked by Chrome after post-open navigation; fall back to redirect
    window.close();
    setTimeout(() => { window.location.href = "/admin/educators"; }, 300);
  }

  return (
    <div className="w-full bg-amber-400 text-amber-950 text-sm font-medium py-2 px-4 flex items-center justify-between shrink-0">
      <span>Admin Mode — Viewing as <strong>{name}</strong></span>
      <button onClick={returnToAdmin} className="underline text-amber-900">Return to Admin Dashboard</button>
    </div>
  );
}
