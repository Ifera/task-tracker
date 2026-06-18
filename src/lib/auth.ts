import { supabase } from "./supabase";

const toEmail = (username: string) =>
  `${username.toLowerCase().trim()}@tasktracker.local`;

export async function signUp(username: string, password: string) {
  return supabase.auth.signUp({
    email: toEmail(username),
    password,
    options: { data: { username } },
  });
}

export async function signIn(username: string, password: string) {
  return supabase.auth.signInWithPassword({
    email: toEmail(username),
    password,
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}
