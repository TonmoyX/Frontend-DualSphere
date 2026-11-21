import { redirect } from "next/navigation";

/** Friends now live in the profile's Friends tab. */
export default async function UserFriendsRedirect({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  redirect(`/profile/${encodeURIComponent(username)}?tab=friends`);
}
