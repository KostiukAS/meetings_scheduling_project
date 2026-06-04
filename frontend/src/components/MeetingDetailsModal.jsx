import React, { useState, useEffect } from 'react';
import api from '../api/axios';

const MeetingDetailsModal = ({ isOpen, onClose, meeting, currentUserId, onSuccess }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ title: '', description: '', frequency: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [localMeeting, setLocalMeeting] = useState(null);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [availableResources, setAvailableResources] = useState([]);
  const [newParticipantId, setNewParticipantId] = useState('');
  const [newParticipantType, setNewParticipantType] = useState('required');
  const [newResourceId, setNewResourceId] = useState('');
  const [newResourceType, setNewResourceType] = useState('required');
  const [allowExternalUsers, setAllowExternalUsers] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(60);

  const getDurationMinutes = (startValue, endValue) => {
    const start = new Date(startValue);
    const end = new Date(endValue);
    const diff = Math.round((end - start) / 60000);
    if (!Number.isFinite(diff) || diff <= 0) {
      return 60;
    }
    return diff;
  };

  useEffect(() => {
    if (meeting) {
      setLocalMeeting(meeting);
      setError('');
      setEditData({
        title: meeting.title,
        description: meeting.description || '',
        frequency: meeting.frequency || 'once'
      });
      setDurationMinutes(getDurationMinutes(meeting.start, meeting.end));
      setAllowExternalUsers(false);
      setNewParticipantId('');
      setNewParticipantType('required');
      setNewResourceId('');
      setNewResourceType('required');
      setIsEditing(false);
    }
  }, [meeting]);

  useEffect(() => {
    if (!isOpen) {
      setAllowExternalUsers(false);
      setError('');
    }
  }, [isOpen]);

  const isOrganizer = localMeeting && Number(localMeeting.organizer_id) === Number(currentUserId);
  const isRecurring = localMeeting && localMeeting.frequency && localMeeting.frequency !== 'once';
  const isRecurrenceStopped = Boolean(localMeeting?.period_stop_time);

  useEffect(() => {
    if (!isOpen || !localMeeting || !isOrganizer) return;

    const fetchUsers = async () => {
      try {
        const projectId = Number(localMeeting.project_id);
        if (allowExternalUsers || !projectId || projectId === 1) {
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
  }, [isOpen, localMeeting, isOrganizer, allowExternalUsers]);

  useEffect(() => {
    if (!isOpen || !isOrganizer) return;

    const fetchResources = async () => {
      try {
        const res = await api.get('/resources/');
        setAvailableResources(res.data);
      } catch (err) {
        setError('Помилка завантаження ресурсів');
      }
    };

    fetchResources();
  }, [isOpen, isOrganizer]);

  if (!isOpen || !localMeeting) return null;

  const handleUpdate = async () => {
    setLoading(true);
    setError('');

    const durationValue = Number(durationMinutes);
    if (!Number.isFinite(durationValue) || durationValue <= 0) {
      setError('Вкажіть коректну тривалість зустрічі.');
      setLoading(false);
      return;
    }

    const startDate = new Date(localMeeting.start);
    const nextEndDate = new Date(startDate);
    nextEndDate.setMinutes(startDate.getMinutes() + durationValue);
    const nextEndTime = nextEndDate.toISOString();

    const isAllowed = await validateChange({
      nextParticipants: localMeeting.participants || [],
      nextResources: localMeeting.resources || [],
      nextEndTime
    });

    if (!isAllowed) {
      setLoading(false);
      return;
    }

    try {
      await api.patch(`/meetings/${localMeeting.id}`, {
        ...editData,
        end_time: nextEndTime
      });
      setLocalMeeting(prev => prev ? { ...prev, ...editData, end: nextEndTime } : prev);
      setDurationMinutes(durationValue);
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

  const normalizeParticipants = (items) => {
    const unique = new Map();
    (items || []).forEach((p) => {
      const id = Number(p.id);
      if (!Number.isFinite(id)) return;
      unique.set(id, {
        id,
        weight: Number(p.weight ?? 1000000)
      });
    });
    return Array.from(unique.values());
  };

  const normalizeResources = (items) => {
    const unique = new Map();
    (items || []).forEach((r) => {
      const id = Number(r.id);
      if (!Number.isFinite(id)) return;
      unique.set(id, {
        id,
        weight: Number(r.weight ?? 1000000)
      });
    });
    return Array.from(unique.values());
  };

  const buildValidationPayload = (participantsList, resourcesList, endTimeOverride) => {
    if (!localMeeting) return null;
    return {
      meeting_id: localMeeting.id,
      soft_validation: true,
      start_time: localMeeting.start,
      end_time: endTimeOverride || localMeeting.end,
      users: normalizeParticipants(participantsList),
      resources: normalizeResources(resourcesList)
    };
  };

  const validateChange = async ({ nextParticipants, nextResources, nextEndTime }) => {
    if (!localMeeting) return false;

    try {
      const basePayload = buildValidationPayload(
        localMeeting.participants || [],
        localMeeting.resources || [],
        localMeeting.end
      );
      const nextPayload = buildValidationPayload(
        nextParticipants,
        nextResources,
        nextEndTime
      );

      if (!basePayload || !nextPayload) {
        setError('Не вдалося підготувати дані для валідації.');
        return false;
      }

      const [baseRes, nextRes] = await Promise.all([
        api.post('/meetings/validate-slot', basePayload),
        api.post('/meetings/validate-slot', nextPayload)
      ]);

      if (!nextRes.data.is_valid) {
        setError('Зміна призводить до критичного конфлікту. Оберіть інший склад або час.');
        return false;
      }

      if (Number(nextRes.data.score) > Number(baseRes.data.score)) {
        const confirmChange = window.confirm(
          `Після змін штраф збільшиться з ${baseRes.data.score} до ${nextRes.data.score}. Продовжити?`
        );
        if (!confirmChange) {
          return false;
        }
      }

      return true;
    } catch (err) {
      setError('Помилка валідації змін. Спробуйте ще раз.');
      return false;
    }
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
      const nextParticipants = [
        ...(localMeeting?.participants || []),
        { id: Number(newParticipantId), weight }
      ];

      const isAllowed = await validateChange({
        nextParticipants,
        nextResources: localMeeting?.resources || [],
        nextEndTime: localMeeting?.end
      });

      if (!isAllowed) {
        setLoading(false);
        return;
      }

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
              status: 'Waiting for response',
              weight
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
      const nextParticipants = (localMeeting?.participants || []).filter(
        p => Number(p.id) !== Number(participantId)
      );
      const isAllowed = await validateChange({
        nextParticipants,
        nextResources: localMeeting?.resources || [],
        nextEndTime: localMeeting?.end
      });

      if (!isAllowed) {
        setLoading(false);
        return;
      }

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

  const handleAddResource = async () => {
    if (!newResourceId) {
      setError('Оберіть ресурс');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const weight = newResourceType === 'required' ? 1000000 : 10;
      const nextResources = [
        ...(localMeeting?.resources || []),
        { id: Number(newResourceId), weight }
      ];

      const isAllowed = await validateChange({
        nextParticipants: localMeeting?.participants || [],
        nextResources,
        nextEndTime: localMeeting?.end
      });

      if (!isAllowed) {
        setLoading(false);
        return;
      }

      await api.post(`/meetings/${localMeeting.id}/resources`, {
        resource_id: Number(newResourceId),
        weight
      });

      const addedResource = availableResources.find(
        r => Number(r.id) === Number(newResourceId)
      );
      if (addedResource) {
        setLocalMeeting(prev => {
          if (!prev) return prev;
          const nextResourcesList = [
            ...(prev.resources || []),
            {
              id: addedResource.id,
              name: addedResource.name,
              weight
            }
          ];
          return { ...prev, resources: nextResourcesList };
        });
      }

      setNewResourceId('');
      onSuccess();
    } catch (err) {
      setError('Помилка додавання ресурсу');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveResource = async (resourceId) => {
    if (!window.confirm('Видалити ресурс зі зустрічі?')) return;

    setLoading(true);
    setError('');

    try {
      const nextResources = (localMeeting?.resources || []).filter(
        r => Number(r.id) !== Number(resourceId)
      );
      const isAllowed = await validateChange({
        nextParticipants: localMeeting?.participants || [],
        nextResources,
        nextEndTime: localMeeting?.end
      });

      if (!isAllowed) {
        setLoading(false);
        return;
      }

      await api.delete(`/meetings/${localMeeting.id}/resources/${resourceId}`);
      setLocalMeeting(prev => {
        if (!prev) return prev;
        const nextResourcesList = (prev.resources || []).filter(
          r => Number(r.id) !== Number(resourceId)
        );
        return { ...prev, resources: nextResourcesList };
      });
      onSuccess();
    } catch (err) {
      setError('Помилка видалення ресурсу');
    } finally {
      setLoading(false);
    }
  };

  const handleStopRecurring = async () => {
    if (!localMeeting) return;
    if (!window.confirm('Зупинити повторювану зустріч з цього дня?')) return;

    setLoading(true);
    setError('');

    try {
      const response = await api.patch(`/meetings/${localMeeting.id}/stop`, {
        stop_time: localMeeting.start
      });
      setLocalMeeting(prev => prev ? { ...prev, period_stop_time: response.data.period_stop_time } : prev);
      onSuccess();
      onClose();
    } catch (err) {
      setError('Помилка зупинки повторення');
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
            <label className="form-label">Тривалість (хв):</label>
            <input
              className="form-control"
              type="number"
              min="15"
              step="15"
              value={durationMinutes}
              onChange={e => setDurationMinutes(e.target.value)}
            />
          </div>
        ) : (
          <div className="modal-body">
            <p><strong>Назва:</strong> {localMeeting.title}</p>
            <p><strong>Опис/Посилання:</strong> {localMeeting.description || <span className="text-muted">Немає опису</span>}</p>
            <p><strong>Час:</strong> {new Date(localMeeting.start).toLocaleString('uk-UA')} - {new Date(localMeeting.end).toLocaleTimeString('uk-UA')}</p>
            {isRecurring && localMeeting.period_stop_time && (
              <p className="text-muted">
                Повтори зупинені з {new Date(localMeeting.period_stop_time).toLocaleString('uk-UA')}
              </p>
            )}

            <div className="section-divider">
              <strong>Ресурси/Кімнати:</strong>
              {localMeeting.resources?.length > 0 ? (
                <ul className="details-list">
                  {localMeeting.resources.map(r => (
                    <li key={r.id} className="details-item">
                      <span>{r.name}</span>
                      {isOrganizer && (
                        <button
                          onClick={() => handleRemoveResource(r.id)}
                          className="btn btn-danger btn-xs"
                          disabled={loading}
                        >
                          Видалити
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">Онлайн (без кімнати)</p>
              )}
            </div>

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
                  <div className="form-field">
                    <label className="form-label">
                      <input
                        type="checkbox"
                        checked={allowExternalUsers}
                        onChange={e => setAllowExternalUsers(e.target.checked)}
                      />
                      {' '}
                      Дозволити учасників поза проєктом
                    </label>
                  </div>
                </div>
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

            {isOrganizer && (
              <div className="section-divider dashed">
                <strong>Додати ресурс:</strong>
                <div className="form-row">
                  <select
                    className="form-control"
                    value={newResourceId}
                    onChange={e => setNewResourceId(e.target.value)}
                  >
                    <option value="">Оберіть ресурс</option>
                    {availableResources
                      .filter(r => !(localMeeting.resources || []).some(item => Number(item.id) === Number(r.id)))
                      .map(r => (
                        <option key={r.id} value={r.id}>
                          {r.capacity != null && r.capacity > 0
                            ? `${r.name} (місткість: ${r.capacity})`
                            : r.name}
                        </option>
                      ))}
                  </select>
                  <select
                    className="form-control"
                    value={newResourceType}
                    onChange={e => setNewResourceType(e.target.value)}
                  >
                    <option value="required">Обов.</option>
                    <option value="optional">Опц.</option>
                  </select>
                  <button
                    onClick={handleAddResource}
                    className="btn btn-primary"
                    disabled={loading || !newResourceId}
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
                  {isRecurring && !isRecurrenceStopped && (
                    <button onClick={handleStopRecurring} className="btn btn-warning" disabled={loading}>
                      Зупинити повторення
                    </button>
                  )}
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
