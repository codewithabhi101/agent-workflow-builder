const AUTH_URL = 'https://bhlvcppwdduecuciuxjj.auth.eu-central-1.nhost.run/v1'

export async function signUp(email: string, password: string) {
  const res = await fetch(`${AUTH_URL}/signup/email-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Sign up failed')
  return data
}

export async function signIn(email: string, password: string) {
  const res = await fetch(`${AUTH_URL}/signin/email-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Sign in failed')
  if (data.session) {
    localStorage.setItem('nhost_session', JSON.stringify(data.session))
  }
  return data
}

export function signOut() {
  localStorage.removeItem('nhost_session')
}

export function getCurrentUser() {
  const raw = localStorage.getItem('nhost_session')
  if (!raw) return null
  try {
    const session = JSON.parse(raw)
    return session.user || null
  } catch {
    return null
  }
}

export function isAuthenticated() {
  return getCurrentUser() !== null
}