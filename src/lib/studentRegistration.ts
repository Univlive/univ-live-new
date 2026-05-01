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
    const data = await res.json().catch(() => null);
    const message = data?.error || data?.detail || `Failed to register student (HTTP ${res.status})`;
    throw new Error(message);
  }

  return res.json().catch(() => ({}));
}
