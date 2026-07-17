import { supabase } from "./supabase";

/** Player renames themselves (spec: "Сменить имя" on Profile). RLS's
 * users_update_self policy (auth.uid() = id) is what actually gates this. */
export async function updateOwnName(userId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Имя не может быть пустым");

  const { error } = await supabase.from("users").update({ name: trimmed }).eq("id", userId);
  if (error) throw error;

  // Keep Supabase Studio's Auth > Users "Display Name" column in sync too —
  // this only touches the caller's own session, no admin/service role needed.
  await supabase.auth.updateUser({ data: { display_name: trimmed } });
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/** Uploads/replaces the user's own avatar in the public "avatars" bucket
 * (path "<userId>/avatar.<ext>", one file per user — storage policies in
 * supabase/add-avatars.sql require the folder to match auth.uid()), then
 * saves the public URL (with a cache-busting query param) on their row. */
export async function updateOwnAvatar(userId: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Файл должен быть изображением");
  if (file.size > MAX_AVATAR_BYTES) throw new Error("Файл слишком большой (максимум 2 МБ)");

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (uploadErr) throw uploadErr;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;

  const { error: updateErr } = await supabase.from("users").update({ avatar_url: avatarUrl }).eq("id", userId);
  if (updateErr) throw updateErr;

  return avatarUrl;
}