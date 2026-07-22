const backendUrl = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

export async function getHealth() {
  const response = await fetch(`${backendUrl}/api/health`)
  if (!response.ok) throw new Error('Health check failed')
  return response.json()
}
