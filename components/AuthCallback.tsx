 import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const BACKEND = 'https://animabing-backend.animabingwatch.workers.dev/api/auth'

const AuthCallback: React.FC = () => {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')

  // ✅ FIX: intent ko turant decide karo — URL state ya saved sessionStorage se
  const params = new URLSearchParams(window.location.search)
  const urlState = params.get('state')
  const savedIntent = sessionStorage.getItem('oauthIntent')
  const intent = urlState || savedIntent || 'user'
  const isSubAdmin = intent === 'subadmin'

  useEffect(() => {
    const code = params.get('code')

    if (!code) {
      setStatus('error')
      setTimeout(() => navigate('/dashboard'), 2000)
      return
    }

    // Purane opposite-panel session ko turant clear karo
    if (isSubAdmin) {
      localStorage.removeItem('shortUserToken')
      localStorage.removeItem('shortUserName')
      localStorage.removeItem('shortUsername')
    } else {
      sessionStorage.removeItem('subAdminToken')
      sessionStorage.removeItem('subAdminUsername')
      sessionStorage.removeItem('subAdminPermissions')
      sessionStorage.removeItem('subAdminAnimeAccess')
    }

    fetch(`${BACKEND}/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(intent)}`)
      .then(res => res.json())
      .then((data: any) => {
        sessionStorage.removeItem('oauthIntent') // cleanup

        if (data.success && data.token && data.role === 'subadmin') {
          sessionStorage.setItem('subAdminToken', data.token)
          sessionStorage.setItem('subAdminUsername', data.subAdmin.username)
          sessionStorage.setItem('subAdminPermissions', JSON.stringify(data.subAdmin.permissions || []))
          sessionStorage.setItem('subAdminAnimeAccess', data.subAdmin.animeAccess || 'own')
          navigate('/sub-admin-dashboard')

        } else if (data.success && data.token) {
          localStorage.setItem('shortUserToken', data.token)
          localStorage.setItem('shortUserName', data.user.realName)
          localStorage.setItem('shortUsername', data.user.username)
          navigate('/dashboard')

        } else if (data.error === 'no_account') {
          if (isSubAdmin) {
            navigate(`/sub-admin-login?error=no_account&gmail=${encodeURIComponent(data.gmail)}`)
          } else {
            navigate(`/dashboard?error=no_account&gmail=${encodeURIComponent(data.gmail)}`)
          }

        } else if (data.error === 'blocked') {
          setStatus('error')
          setTimeout(() => navigate('/sub-admin-login'), 2500)

        } else {
          setStatus('error')
          setTimeout(() => navigate(isSubAdmin ? '/sub-admin-login' : '/dashboard'), 2000)
        }
      })
      .catch(() => {
        sessionStorage.removeItem('oauthIntent')
        setStatus('error')
        setTimeout(() => navigate(isSubAdmin ? '/sub-admin-login' : '/dashboard'), 2000)
      })
  }, [])

  // ✅ FIX: theme intent ke hisaab se turant decide, fetch ka wait nahi
  const bg = isSubAdmin
    ? 'radial-gradient(ellipse at 50% 40%, #4c1d95 0%, #3b0764 40%, #1e0533 100%)'
    : 'linear-gradient(135deg,#f0efff,#f8f4ff,#eff5ff)'
  const textColor = isSubAdmin ? '#e9d5ff' : '#534AB7'
  const subTextColor = isSubAdmin ? 'rgba(196,181,253,0.55)' : '#9999bb'
  const spinnerBorder = isSubAdmin ? 'rgba(192,132,252,0.15)' : '#e0deff'
  const spinnerTop = isSubAdmin ? '#c084fc' : '#534AB7'

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: bg,
    }}>
      <div style={{ textAlign: 'center' }}>
        {status === 'loading' ? (
          <>
            <div style={{
              width: 44, height: 44,
              border: `3px solid ${spinnerBorder}`,
              borderTopColor: spinnerTop,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            <p style={{ color: textColor, fontWeight: 600, fontSize: 15 }}>
              {isSubAdmin ? 'Sub-Admin login ho raha hai...' : 'Google se login ho raha hai...'}
            </p>
            <p style={{ color: subTextColor, fontSize: 13, marginTop: 6 }}>
              Wait for login..⏳
            </p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 44, marginBottom: 12 }}>❌</div>
            <p style={{ color: '#d85a30', fontWeight: 600 }}>Login fail</p>
            <p style={{ color: subTextColor, fontSize: 13 }}>
              We’re going back…
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default AuthCallback