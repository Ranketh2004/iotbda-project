import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function GoogleCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const userId = searchParams.get('user');

    if (token) {
      localStorage.setItem('cryguard_token', token);
      // Fetch user profile with the token and store it
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((user) => {
          if (user) {
            localStorage.setItem('cryguard_user', JSON.stringify(user));
          }
          navigate('/dashboard', { replace: true });
        })
        .catch(() => {
          navigate('/dashboard', { replace: true });
        });
    } else {
      navigate('/login', { replace: true });
    }
  }, [navigate, searchParams]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p>Signing you in…</p>
    </div>
  );
}
