import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Login | Meetings Scheduler';
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      // Формуємо дані у форматі URL-encoded (Form Data), як того вимагає FastAPI OAuth2
      const formData = new URLSearchParams();
      formData.append('username', email); // Назва ключа обов'язково 'username'
      formData.append('password', password);

      const response = await api.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      // Зберігаємо токен у локальне сховище браузера
      localStorage.setItem('token', response.data.access_token);
      
      // Перенаправляємо на головну сторінку
      navigate('/'); 
    } catch (err) {
      setError('Неправильний email або пароль');
    }
  };

  return (
    <div className="login-page">
      <div className="login-orb orb-1" />
      <div className="login-orb orb-2" />
      <div className="login-shell">
        <div className="login-hero">
          <span className="login-kicker">Meetings Scheduler</span>
          <h1 className="login-title">Планування зустрічей без зайвого шуму</h1>
          <p className="login-subtitle">
            Знаходьте вільні слоти та узгоджуйте зустрічі без довгих листувань
          </p>
        </div>

        <div className="login-card">
          <div>
            <h2 className="login-card-title">Вхід у систему</h2>
            <p className="login-card-subtitle">Введіть ваші дані доступу</p>
          </div>

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleLogin} className="login-form">
            <label className="login-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="login-input"
            />

            <label className="login-label" htmlFor="login-password">Пароль</label>
            <input
              id="login-password"
              type="password"
              placeholder="Ваш пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="login-input"
            />

            <button type="submit" className="login-button">
              Увійти
            </button>
          </form>

          <p className="login-footer">Доступ дозволений лише співробітникам компанії</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
