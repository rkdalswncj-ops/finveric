export function token() {
  return sessionStorage.getItem("finveric-token") ?? "";
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL ?? ""}/api${path}`,
    {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? "요청을 완료하지 못했어요.");
  return value as T;
}
export function saveFile(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
