import React, { useState } from 'react'
import { signIn, signUp } from './nhost'

export default function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isSignUp) {
        await signUp(email, password)
        onLoggedIn()
      } else {
        await signIn(email, password)
        onLoggedIn()
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-slate-950 text-slate-100">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-8 w-full max-w-sm shadow-2xl"
      >
        <h1 className="text-xl font-semibold mb-1">
          {isSignUp ? 'Create an account' : 'Sign in'}
        </h1>
        <p className="text-slate-400 text-sm mb-6">
          {isSignUp ? 'Get started with FlowAI' : 'Welcome back to FlowAI'}
        </p>

        {error && (
          <div className="bg-rose-950/50 border border-rose-800 text-rose-300 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 mb-4 text-sm focus:outline-none focus:border-indigo-500"
          placeholder="you@example.com"
        />

        <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
        <input
          type="password"
          required
          minLength={9}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 mb-6 text-sm focus:outline-none focus:border-indigo-500"
          placeholder="At least 9 characters"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg py-2.5 text-sm transition disabled:opacity-50"
        >
          {loading ? 'Please wait...' : isSignUp ? 'Sign up' : 'Sign in'}
        </button>

        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="w-full text-center text-xs text-slate-400 hover:text-slate-200 mt-4"
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </form>
    </div>
  )
}