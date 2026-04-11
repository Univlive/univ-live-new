export async function registerStudentForTenant(token: string, tenantSlug: string) {
  const res = await fetch("/api/tenant/register-student", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tenantSlug }),
  });

  if (!res.ok) {
    const contentType = String(res.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("application/json")) {
      const data = await res.json().catch(() => null);
      const message =
        typeof data?.error === "string" && data.error.trim()
          ? data.error
          : `Failed to register student for this tenant (HTTP ${res.status})`;
      throw new Error(message);
    }

    const text = (await res.text().catch(() => "")).trim();
    throw new Error(
      text
        ? `Failed to register student for this tenant (HTTP ${res.status}): ${text.slice(0, 160)}`
        : `Failed to register student for this tenant (HTTP ${res.status})`
    );
  }

  return res.json().catch(() => ({}));
}
