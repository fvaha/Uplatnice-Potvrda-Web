import { useState } from 'react'
import { motion } from 'framer-motion'
import { Lock, User, AlertCircle } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

const API_BASE = '/uplatnice/api'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_BASE}/auth.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'login',
          username,
          password
        })
      })

      const data = await response.json()

      if (data.success && data.token) {
        // Store token in localStorage
        localStorage.setItem('auth_token', data.token)
        localStorage.setItem('auth_time', Date.now().toString())
        onLogin(data.token)
      } else {
        setError(data.error || 'Pogrešno korisničko ime ili šifra')
      }
    } catch (error) {
      console.error('Login error:', error)
      setError('Greška pri prijavljivanju. Pokušajte ponovo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md"
      >
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Lock className="text-primary" size={32} />
              </div>
            </div>
            <CardTitle className="text-2xl">Prijava</CardTitle>
            <p className="text-muted-foreground text-sm mt-2">
              Unesite korisničko ime i šifru za pristup aplikaciji
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="username">Korisničko ime</Label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-9"
                    placeholder="Unesite korisničko ime"
                    required
                    autoFocus
                    disabled={loading}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="password">Lozinka</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    placeholder="••••••••"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-destructive/10 border border-destructive/20"
                >
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                </motion.div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Prijavljivanje...' : 'Prijavi se'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

