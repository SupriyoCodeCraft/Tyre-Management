import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { routePaths } from '../../app/routePaths.js';
import { Button } from '../../components/common/Button.jsx';
import { Input } from '../../components/common/Input.jsx';
import { PageContainer } from '../../components/common/PageContainer.jsx';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = login(username, password);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    const destination = location.state?.from;
    navigate(
      destination
        ? `${destination.pathname}${destination.search ?? ''}${destination.hash ?? ''}`
        : routePaths.dashboard,
      { replace: true },
    );
  }

  return (
    <main className="login-shell">
      <div className="login-card">
        <div className="brand login-brand"><span className="brand-mark" aria-hidden="true">T</span><span>Tyre Management</span></div>
        <PageContainer eyebrow="Operator access" title="Sign in" description="Sign in to manage tyre operations across your business clients and sites." />
        <form className="login-form" onSubmit={handleSubmit}>
          <Input
            id="username"
            name="username"
            label="Username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
          <Input
            id="password"
            name="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error && <p className="login-error" role="alert">{error}</p>}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="prototype-note">Prototype demonstration login. This is not production authentication.</p>
      </div>
    </main>
  );
}
