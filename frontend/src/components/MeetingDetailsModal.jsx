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
        const projectId = Number(localMeeting.project_id);
        if (!projectId || projectId === 1) {
          const res = await api.get('/users/');
          setAvailableUsers(res.data);
        } else {
          const res = await api.get(`/projects/${projectId}/members`);
          setAvailableUsers(res.data);
        }
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
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="modal-title">{isEditing ? "Редагування" : "Деталі зустрічі"}</h2>
          <button onClick={onClose} className="icon-button">✕</button>
        </div>

        {isEditing ? (
          <div className="form-stack">
            <input
              className="form-control"
              value={editData.title}
              onChange={e => setEditData({...editData, title: e.target.value})}
              placeholder="Назва"
            />
            <textarea
              className="form-control form-textarea-lg"
              value={editData.description}
              onChange={e => setEditData({...editData, description: e.target.value})}
              placeholder="Опис або посилання"
            />
            <select
              className="form-control"
              value={editData.frequency}
              onChange={e => setEditData({...editData, frequency: e.target.value})}
            >
              <option value="once">Один раз</option>
              <option value="daily">Щодня</option>
              <option value="weekly">Щотижня</option>
            </select>
          </div>
        ) : (
          <div className="modal-body">
            <p><strong>Назва:</strong> {localMeeting.title}</p>
            <p><strong>Опис/Посилання:</strong> {localMeeting.description || <span className="text-muted">Немає опису</span>}</p>
            <p><strong>Час:</strong> {new Date(localMeeting.start).toLocaleString('uk-UA')} - {new Date(localMeeting.end).toLocaleTimeString('uk-UA')}</p>
            
            <p><strong>Кімнати:</strong> {localMeeting.resources?.length > 0 
              ? localMeeting.resources.map(r => r.name).join(', ') 
              : 'Онлайн (без кімнати)'}
            </p>

            <div className="section-divider">
              <strong>Учасники:</strong>
              <ul className="details-list">
                {localMeeting.participants?.map(p => (
                  <li key={p.id} className="details-item">
                    <span>{p.full_name || p.email} — <i>{p.status}</i></span>
                    {isOrganizer && Number(p.id) !== Number(localMeeting.organizer_id) && (
                      <button
                        onClick={() => handleRemoveParticipant(p.id)}
                        className="btn btn-danger btn-xs"
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
              <div className="section-divider dashed">
                <strong>Додати учасника:</strong>
                <div className="form-row">
                  <select
                    className="form-control"
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
                    className="form-control"
                    value={newParticipantType}
                    onChange={e => setNewParticipantType(e.target.value)}
                  >
                    <option value="required">Обов.</option>
                    <option value="optional">Опц.</option>
                  </select>
                  <button
                    onClick={handleAddParticipant}
                    className="btn btn-primary"
                    disabled={loading || !newParticipantId}
                  >
                    Додати
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-danger">{error}</p>}

        <div className="modal-actions">
          {isOrganizer ? (
            <>
              {isEditing ? (
                <>
                  <button onClick={handleUpdate} disabled={loading} className="btn btn-success">Зберегти</button>
                  <button onClick={() => setIsEditing(false)} className="btn btn-muted">Скасувати</button>
                </>
              ) : (
                <>
                  <button onClick={() => setIsEditing(true)} className="btn btn-primary">Редагувати</button>
                  <button onClick={handleDelete} className="btn btn-danger">Видалити</button>
                </>
              )}
            </>
          ) : (
            <>
              <button onClick={() => handleStatusChange("Accepted")} className="btn btn-success">Прийду</button>
              <button onClick={() => handleStatusChange("Rejected")} className="btn btn-danger">Не прийду</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingDetailsModal;
