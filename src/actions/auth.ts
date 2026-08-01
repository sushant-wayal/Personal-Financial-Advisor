'use server';

import { createSession, deleteSession } from '../lib/session';
import { redirect } from 'next/navigation';

export async function login(password: string) {
  if (password === process.env.ADMIN_PASSWORD) {
    await createSession();
    return { success: true };
  }
  return { success: false, error: 'Invalid password' };
}

export async function logout() {
  await deleteSession();
  redirect('/login');
}
