import React, { useState, useEffect } from 'react';
import api from '../api/axios';

const MeetingDetailsModal = ({ isOpen, onClose, meeting, currentUserId, onSuccess }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ title: '', description: '', frequency: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [localMeeting, setLocalMeeting] = useState(null);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [newParticipantId, setNewParticipantId] = useState('');
  const [newParticipantType, setNewParticipantType] = useState('required');

  useEffect(() => {
    if (meeting) {
      setLocalMeeting(meeting);
      setEditData({
        title: meeting.title,
        description: meeting.description || '',
        frequency: meeting.frequency || 'once'
      });
      setIsEditing(false);
    }
  }, [meeting]);

  const isOrganizer = localMeeting && Number(localMeeting.organizer_id) === Number(currentUserId);

  useEffect(() => {
    if (!isOpen || !localMeeting || !isOrganizer) return;

    const fetchUsers = async () => {
      try {
        const res = await api.get('/users/');
        setAvailableUsers(res.data);
      } catch (err) {
        setError('Помилка завантаження користувачів');
      }
    };

    fetchUsers();
  }, [isOpen, localMeeting, isOrganizer]);

  if (!isOpen || !localMeeting) return null;

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await api.patch(`/meetings/${localMeeting.id}`, editData);
      setLocalMeeting(prev => prev ? { ...prev, ...editData } : prev);
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
      await api.delete(`/meetings/${localMeeting.id}`);
      onSuccess();
      onClose();
    } catch (err) { setError("Помилка видалення"); }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await api.patch(`/meetings/${localMeeting.id}/participants/${currentUserId}/status`, { status: newStatus });
      onSuccess();
      onClose();
    } catch (err) { setError("Помилка зміни статусу"); }
  };

  const handleAddParticipant = async () => {
    if (!newParticipantId) {
      setError('Оберіть користувача');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const weight = newParticipantType === 'required' ? 1000000 : 10;
      await api.post(`/meetings/${localMeeting.id}/participants`, {
        user_id: Number(newParticipantId),
        weight
      });

      const addedUser = availableUsers.find(u => Number(u.id) === Number(newParticipantId));
      if (addedUser) {
        setLocalMeeting(prev => {
          if (!prev) return prev;
          const nextParticipants = [
            ...(prev.participants || []),
            {
              id: addedUser.id,
              full_name: addedUser.full_name || null,
              email: addedUser.email,
              status: 'Waiting for response'
            }
          ];
          return { ...prev, participants: nextParticipants };
        });
      }

      setNewParticipantId('');
      onSuccess();
    } catch (err) {
      setError('Помилка додавання учасника');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveParticipant = async (participantId) => {
    if (!window.confirm('Видалити учасника зі зустрічі?')) return;

    setLoading(true);
    setError('');

    try {
      await api.delete(`/meetings/${localMeeting.id}/participants/${participantId}`);
      setLocalMeeting(prev => {
        if (!prev) return prev;
        const nextParticipants = (prev.participants || []).filter(
          p => Number(p.id) !== Number(participantId)
        );
        return { ...prev, participants: nextParticipants };
      });
      onSuccess();
    } catch (err) {
      setError('Помилка видалення учасника');
    } finally {
      setLoading(false);
    }
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
            <p><strong>Назва:</strong> {localMeeting.title}</p>
            <p><strong>Опис/Посилання:</strong> {localMeeting.description || <span style={{color: '#999'}}>Немає опису</span>}</p>
            <p><strong>Час:</strong> {new Date(localMeeting.start).toLocaleString('uk-UA')} - {new Date(localMeeting.end).toLocaleTimeString('uk-UA')}</p>
            
            <p><strong>Кімнати:</strong> {localMeeting.resources?.length > 0 
              ? localMeeting.resources.map(r => r.name).join(', ') 
              : 'Онлайн (без кімнати)'}
            </p>

            <div style={{ marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
              <strong>Учасники:</strong>
              <ul style={{ paddingLeft: '20px' }}>
                {localMeeting.participants?.map(p => (
                  <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{p.full_name || p.email} — <i>{p.status}</i></span>
                    {isOrganizer && Number(p.id) !== Number(localMeeting.organizer_id) && (
                      <button
                        onClick={() => handleRemoveParticipant(p.id)}
                        style={removeMiniBtn}
                        disabled={loading}
                      >
                        Видалити
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {isOrganizer && (
              <div style={{ marginTop: '12px', borderTop: '1px dashed #eee', paddingTop: '10px' }}>
                <strong>Додати учасника:</strong>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <select
                    style={miniSelect}
                    value={newParticipantId}
                    onChange={e => setNewParticipantId(e.target.value)}
                  >
                    <option value="">Оберіть користувача</option>
                    {availableUsers
                      .filter(u => !(localMeeting.participants || []).some(p => Number(p.id) === Number(u.id)))
                      .map(u => (
                        <option key={u.id} value={u.id}>
                          {u.full_name || u.email}
                        </option>
                      ))}
                  </select>
                  <select
                    style={miniSelect}
                    value={newParticipantType}
                    onChange={e => setNewParticipantType(e.target.value)}
                  >
                    <option value="required">Обов.</option>
                    <option value="optional">Опц.</option>
                  </select>
                  <button
                    onClick={handleAddParticipant}
                    style={addMiniBtn}
                    disabled={loading || !newParticipantId}
                  >
                    Додати
                  </button>
                </div>
              </div>
            )}
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
const miniSelect = { padding: '6px', border: '1px solid #ccc', borderRadius: '4px', flex: 1 };
const addMiniBtn = { padding: '6px 10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' };
const removeMiniBtn = { padding: '4px 8px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' };

export default MeetingDetailsModal;
