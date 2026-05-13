import React, { useState, useEffect } from 'react';
import api from '../api/axios';

const MeetingDetailsModal = ({ isOpen, onClose, meeting, currentUserId, onSuccess }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ title: '', description: '', frequency: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (meeting) {
      setEditData({
        title: meeting.title,
        description: meeting.description || '',
        frequency: meeting.frequency || 'once'
      });
      setIsEditing(false);
    }
  }, [meeting]);

  if (!isOpen || !meeting) return null;

  const isOrganizer = Number(meeting.organizer_id) === Number(currentUserId);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await api.patch(`/meetings/${meeting.id}`, editData);
      onSuccess();
      setIsEditing(false);
    } catch (err) {
      setError("Помилка при оновленні зустрічі");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Ви впевнені?")) return;
    try {
      await api.delete(`/meetings/${meeting.id}`);
      onSuccess();
      onClose();
    } catch (err) { setError("Помилка видалення"); }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await api.patch(`/meetings/${meeting.id}/participants/${currentUserId}/status`, { status: newStatus });
      onSuccess();
      onClose();
    } catch (err) { setError("Помилка зміни статусу"); }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
          <h2>{isEditing ? "Редагування" : "Деталі зустрічі"}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
        </div>

        {isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input 
              style={inputStyle} 
              value={editData.title} 
              onChange={e => setEditData({...editData, title: e.target.value})} 
              placeholder="Назва"
            />
            <textarea 
              style={{ ...inputStyle, height: '80px' }} 
              value={editData.description} 
              onChange={e => setEditData({...editData, description: e.target.value})} 
              placeholder="Опис або посилання"
            />
            <select 
              style={inputStyle} 
              value={editData.frequency} 
              onChange={e => setEditData({...editData, frequency: e.target.value})}
            >
              <option value="once">Один раз</option>
              <option value="daily">Щодня</option>
              <option value="weekly">Щотижня</option>
            </select>
          </div>
        ) : (
          <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
            <p><strong>Назва:</strong> {meeting.title}</p>
            <p><strong>Опис/Посилання:</strong> {meeting.description || <span style={{color: '#999'}}>Немає опису</span>}</p>
            <p><strong>Час:</strong> {new Date(meeting.start).toLocaleString('uk-UA')} - {new Date(meeting.end).toLocaleTimeString('uk-UA')}</p>
            
            <p><strong>Кімнати:</strong> {meeting.resources?.length > 0 
              ? meeting.resources.map(r => r.name).join(', ') 
              : 'Онлайн (без кімнати)'}
            </p>

            <div style={{ marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
              <strong>Учасники:</strong>
              <ul style={{ paddingLeft: '20px' }}>
                {meeting.participants?.map(p => (
                  <li key={p.id}>
                    {p.full_name || p.email} — <i>{p.status}</i>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          {isOrganizer ? (
            <>
              {isEditing ? (
                <>
                  <button onClick={handleUpdate} disabled={loading} style={successBtnStyle}>Зберегти</button>
                  <button onClick={() => setIsEditing(false)} style={tab}>Скасувати</button>
                </>
              ) : (
                <>
                  <button onClick={() => setIsEditing(true)} style={primaryBtnStyle}>Редагувати</button>
                  <button onClick={handleDelete} style={dangerBtnStyle}>Видалити</button>
                </>
              )}
            </>
          ) : (
            <>
              <button onClick={() => handleStatusChange("Accepted")} style={successBtnStyle}>Прийду</button>
              <button onClick={() => handleStatusChange("Rejected")} style={dangerBtnStyle}>Не прийду</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Стилі (ідентичні іншим модалкам)
const overlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalStyle = { backgroundColor: 'white', padding: '25px', borderRadius: '8px', width: '450px', maxHeight: '90vh', overflowY: 'auto' };
const inputStyle = { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', width: '100%', boxSizing: 'border-box' };
const primaryBtnStyle = { flex: 1, padding: '10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' };
const successBtnStyle = { flex: 1, padding: '10px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' };
const dangerBtnStyle = { flex: 1, padding: '10px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' };
const tab = { flex: 1, padding: '10px', background: '#eee', border: 'none', borderRadius: '4px', cursor: 'pointer' };

export default MeetingDetailsModal;
