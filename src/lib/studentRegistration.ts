export async function registerStudentForTenant(token: string, tenantSlug: string) {
  const res = await fetch("/api/tenant/register-student", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tenantSlug }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      typeof data?.error === "string" && data.error.trim()
        ? data.error
        : `Failed to register student for ${tenantSlug}`;
    throw new Error(message);
  }

  return data;
}
