import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const BACKEND = 'https://animabing-backend.animabingwatch.workers.dev/api/auth'

const AuthCallback: React.FC = () => {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')

    if (!code) {
      setStatus('error')
      setTimeout(() => navigate('/dashboard'), 2000)
      return
    }

    fetch(`${BACKEND}/google/callback?code=${encodeURIComponent(code)}`)
      .then(res => res.json())
      .then((data: any) => {

        if (data.success && data.token) {
          // ✅ User mila — login karo
          localStorage.setItem('shortUserToken', data.token)
          localStorage.setItem('shortUserName', data.user.realName)
          localStorage.setItem('shortUsername', data.user.username)
          navigate('/dashboard')

        } else if (data.error === 'no_account') {
          // ⚠️ Gmail se account nahi mila — register pe bhejo
          navigate(
            `/dashboard?error=no_account&gmail=${encodeURIComponent(data.gmail)}`
          )

        } else {
          // ❌ Koi aur error
          setStatus('error')
          setTimeout(() => navigate('/dashboard'), 2000)
        }
      })
      .catch(() => {
        setStatus('error')
        setTimeout(() => navigate('/dashboard'), 2000)
      })
  }, [])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#f0efff,#f8f4ff,#eff5ff)',
    }}>
      <div style={{ textAlign: 'center' }}>
        {status === 'loading' ? (
          <>
            <div style={{
              width: 44, height: 44,
              border: '3px solid #e0deff',
              borderTopColor: '#534AB7',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            <p style={{ color: '#534AB7', fontWeight: 600, fontSize: 15 }}>
              Google se login ho raha hai...
            </p>
            <p style={{ color: '#9999bb', fontSize: 13, marginTop: 6 }}>
              Ek second rukiye ⏳
            </p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 44, marginBottom: 12 }}>❌</div>
            <p style={{ color: '#d85a30', fontWeight: 600 }}>Login fail hua</p>
            <p style={{ color: '#9999bb', fontSize: 13 }}>
              Dashboard pe wapas ja rahe hain...
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default AuthCallback