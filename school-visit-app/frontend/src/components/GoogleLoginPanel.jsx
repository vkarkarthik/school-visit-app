import { useEffect, useRef, useState } from 'react';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const ALLOWED_EMAIL_DOMAINS = ['@superteacher.in', '@superteacher.co.in'];

function isAllowedSuperTeacherEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return ALLOWED_EMAIL_DOMAINS.some((domain) => normalizedEmail.endsWith(domain));
}

export default function GoogleLoginPanel({ currentUser, onLogin, onLogout }) {
  const buttonRef = useRef(null);
  const [message, setMessage] = useState('');
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (!googleClientId || currentUser?.authProvider === 'google') return;

    const loadGoogle = () =>
      new Promise((resolve, reject) => {
        if (window.google?.accounts?.id) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });

    loadGoogle()
      .then(() => {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response) => {
            const profile = decodeJwt(response.credential);
            const email = String(profile.email || '').toLowerCase();

            if (!isAllowedSuperTeacherEmail(email)) {
              setMessage('Please sign in using your SuperTeacher Google account.');
              return;
            }

            onLogin({
              name: profile.name || email.split('@')[0],
              email,
              role: 'Program Manager',
              authProvider: 'google',
              credential: response.credential,
              picture: profile.picture || ''
            });
          }
        });

        if (buttonRef.current) {
          window.google.accounts.id.renderButton(buttonRef.current, {
            theme: 'outline',
            size: 'large',
            width: 260
          });
        }
      })
      .catch(() => setMessage('Google Sign-In could not be loaded. Check internet connection.'));
  }, [currentUser?.authProvider, onLogin]);

  if (currentUser?.authProvider === 'google') {
    const initials = getInitials(currentUser.name || currentUser.email);

    return (
      <section className="identity-panel google-identity">
        <div className="google-profile">
          {currentUser.picture && !imageFailed ? (
            <img src={currentUser.picture} alt="" onError={() => setImageFailed(true)} />
          ) : (
            <span className="avatar-fallback">{initials}</span>
          )}
          <div>
            <span className="eyebrow">Signed in with Google</span>
            <strong>{currentUser.name}</strong>
            <p>{currentUser.email}</p>
          </div>
        </div>
        <button type="button" className="ghost-button logout-button" onClick={onLogout}>
          Logout
        </button>
      </section>
    );
  }

  return (
    <section className="identity-panel google-identity">
      <div>
        <span className="eyebrow">Google login</span>
        <strong>Sign in with your SuperTeacher account</strong>
        <p className="muted-text">
          {googleClientId
            ? 'Your session will stay active on this browser until logout.'
            : 'Google Client ID is not configured yet. Temporary identity entry is available below.'}
        </p>
      </div>
      {googleClientId && <div ref={buttonRef} className="google-button" />}
      {message && <span className="field-error">{message}</span>}
    </section>
  );
}

function getInitials(value) {
  return String(value || 'ST')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'ST';
}

export function isGoogleConfigured() {
  return Boolean(googleClientId);
}

function decodeJwt(token) {
  const payload = token.split('.')[1] || '';
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const decoded = decodeURIComponent(
    atob(normalized)
      .split('')
      .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
      .join('')
  );

  return JSON.parse(decoded);
}
