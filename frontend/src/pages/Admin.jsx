import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import api from '../api/axios';
import { hasAllPermission } from '../utils/permissions';

const Admin = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);

  const baseUrl = api.defaults.baseURL || 'http://127.0.0.1:8000';
  const openApiUrl = `${baseUrl.replace(/\/$/, '')}/openapi.json`;

  const attachAuthHeader = (request) => {
    const token = localStorage.getItem('token');
    if (token) {
      request.headers = request.headers || {};
      request.headers.Authorization = `Bearer ${token}`;
    }

    return request;
  };

  useEffect(() => {
    document.title = 'Admin | Meetings Scheduler';
  }, []);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const userResponse = await api.get('/users/me');
        const rolesResponse = await api.get('/roles/');
        const role = rolesResponse.data.find(
          (item) => Number(item.id) === Number(userResponse.data.role_id)
        );
        const allowed = hasAllPermission(role?.permissions);

        if (!allowed) {
          navigate('/');
          return;
        }

        setIsAllowed(true);
      } catch (error) {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          navigate('/login');
          return;
        }

        navigate('/');
      } finally {
        setChecking(false);
      }
    };

    checkAccess();
  }, [navigate]);

  if (checking) {
    return (
      <div className="admin-page">
        <div className="card admin-loading">Перевіряємо доступ...</div>
      </div>
    );
  }

  if (!isAllowed) {
    return null;
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Адміністрування</p>
          <h1 className="admin-title">API-консоль</h1>
          <p className="admin-subtitle">
            Керуйте даними через ендпоінти та перевіряйте відповіді API.
          </p>
        </div>
        <div className="admin-actions">
          <button className="btn btn-muted" onClick={() => navigate('/')}>
            Назад до розкладу
          </button>
        </div>
      </header>

      <div className="card admin-card">
        <div className="admin-swagger">
          <SwaggerUI url={openApiUrl} requestInterceptor={attachAuthHeader} />
        </div>
      </div>

      <p className="admin-note">
        Токен додається автоматично з локального сховища після логіну.
      </p>
    </div>
  );
};

export default Admin;
