import { redirect } from "next/navigation";

/**
 * The bare `/` route has no user-facing content of its own. Admins use
 * `/admin/login`; respondents land at `/survey/[token]` via their invitation
 * email link. Redirect unauthenticated hits at the root to the admin login.
 */
export default function Home() {
  redirect("/admin/login");
}
