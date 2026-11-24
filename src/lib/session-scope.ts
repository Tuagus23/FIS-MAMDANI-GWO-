interface SessionReference {
  user: { id: string };
  access_token: string;
}

// Used only for cache partitioning and ignoring obsolete responses, never for authorization.
export function sessionScope(session: SessionReference): string {
  try {
    const payload = JSON.parse(
      atob(
        session.access_token
          .split(".")[1]
          .replace(/-/g, "+")
          .replace(/_/g, "/"),
      ),
    );
    if (typeof payload.session_id === "string")
      return `${session.user.id}:${payload.session_id}`;
  } catch {}
  return `${session.user.id}:${session.access_token}`;
}

export function isCurrentSession(
  request: SessionReference,
  current: SessionReference | null,
): boolean {
  return current !== null && sessionScope(request) === sessionScope(current);
}
