import React, { useState } from 'react';
import api from '../api/axios';

const MeetingDetailsModal = ({ isOpen, onClose, meeting, currentUserId, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !meeting) return null;

  // Перевіряємо, чи є поточний користувач організатором
  const isOrganizer = Number(meeting.organizer_id) === Number(currentUserId);

  // Функція для видалення зустрічі (тільки для організатора)
  const handleDelete = async () => {
    if (!window.confirm("Ви впевнені, що хочете скасувати цю зустріч?")) return;
    
    setLoading(true);
    try {
      await api.delete(`/meetings/${meeting.id}`);
      onSuccess(); // Оновлюємо календар
      onClose();   // Закриваємо модалку
    } catch (err) {
      setError(err.response?.data?.detail || "Помилка при видаленні зустрічі");
    } finally {
      setLoading(false);
    }
  };

  // Функція для зміни статусу (для учасників)
  const handleStatusChange = async (newStatus) => {
    setLoading(true);
    try {
      await api.patch(`/meetings/${meeting.id}/participants/${currentUserId}/status`, {
        status: newStatus
      });
      alert(`Ваш статус успішно змінено на: ${newStatus}`);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Помилка при зміні статусу");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2>Деталі зустрічі</h2>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <p><strong>Назва:</strong> {meeting.title}</p>
          <p><strong>Початок:</strong> {new Date(meeting.start).toLocaleString('uk-UA')}</p>
          <p><strong>Кінець:</strong> {new Date(meeting.end).toLocaleString('uk-UA')}</p>
          <p><strong>Роль:</strong> {isOrganizer ? "👑 Організатор" : "👤 Учасник"}</p>
        </div>

        {error && <p style={{ color: 'red', marginBottom: '15px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {isOrganizer ? (
            <button 
              onClick={handleDelete} 
              disabled={loading} 
              style={dangerBtnStyle}
            >
              {loading ? "Видалення..." : "Видалити зустріч"}
            </button>
          ) : (
            <>
              <p style={{ width: '100%', margin: '0 0 10px 0', fontWeight: 'bold' }}>Ваша відповідь (RSVP):</p>
              <button onClick={() => handleStatusChange("Accepted")} disabled={loading} style={successBtnStyle}>
                ✅ Прийду
              </button>
              <button onClick={() => handleStatusChange("Rejected")} disabled={loading} style={dangerBtnStyle}>
                ❌ Не прийду
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Стилі ---
const overlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalStyle = { backgroundColor: 'white', padding: '25px', borderRadius: '8px', width: '400px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' };
const closeBtnStyle = { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' };
const dangerBtnStyle = { backgroundColor: '#dc3545', color: 'white', padding: '10px 15px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' };
const successBtnStyle = { backgroundColor: '#28a745', color: 'white', padding: '10px 15px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' };

export default MeetingDetailsModal;
