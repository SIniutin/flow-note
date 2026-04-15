// ─── src/types/pages.ts ───────────────────────────────────────────────────────
// Types derived from page.proto v1 and media.proto v1.

// ── PagePermissionRole (page.proto) ───────────────────────────────────────────
// Enum values match proto field numbers:
//   VIEWER    = 1
//   COMMENTER = 2  ← new
//   EDITOR    = 3  ← was 2
//   MENTOR    = 4  ← new
//   OWNER     = 5  ← was 3

export type PagePermissionRole =
    | "viewer"
    | "commenter"
    | "editor"
    | "mentor"
    | "owner";

export const PAGE_PERMISSION_ROLES: PagePermissionRole[] = [
    "viewer",
    "commenter",
    "editor",
    "mentor",
    "owner",
];

export const PAGE_PERMISSION_ROLE_LABELS: Record<PagePermissionRole, string> = {
    viewer:    "Читатель",
    commenter: "Комментатор",
    editor:    "Редактор",
    mentor:    "Ментор",
    owner:     "Владелец",
};

// ── PagePermission ────────────────────────────────────────────────────────────

export interface PagePermission {
    id:        string;
    pageId:    string;
    userId:    string;
    role:      PagePermissionRole;
    grantedBy: string;
    createdAt: string;
    updatedAt: string;
}
