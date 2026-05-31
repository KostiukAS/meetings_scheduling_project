import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

const ScheduleModal = ({ isOpen, onClose, onSuccess, currentUserId }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(60);
  const [frequency, setFrequency] = useState('once');
  
  // Дата/час для сценаріїв 2 та 4
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingStartTime, setMeetingStartTime] = useState('');

  // Діапазон для сценарію 3
  const [rangeStartDate, setRangeStartDate] = useState('');
  const [rangeStartTime, setRangeStartTime] = useState('');
  const [rangeEndDate, setRangeEndDate] = useState('');
  const [rangeEndTime, setRangeEndTime] = useState('');
  
  const [allUsers, setAllUsers] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [availableResources, setAvailableResources] = useState([]);
  const [availableProjects, setAvailableProjects] = useState([]);
  
  const [participants, setParticipants] = useState({});
  const [resources, setResources] = useState({});
  const [selectedProject, setSelectedProject] = useState(1);

  const [slots, setSlots] = useState([]);
  const [validationResult, setValidationResult] = useState(null);
  const [validatedSlot, setValidatedSlot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const resetFormState = useCallback(() => {
    setTitle('');
    setDescription('');
    setDuration(60);
    setFrequency('once');
    setMeetingDate('');
    setMeetingStartTime('');
    setRangeStartDate('');
    setRangeStartTime('');
    setRangeEndDate('');
    setRangeEndTime('');
    setAllUsers([]);
    setAvailableUsers([]);
    setParticipants({});
    setResources({});
    setSelectedProject(1);
    setSlots([]);
    setValidationResult(null);
    setValidatedSlot(null);
    setLoading(false);
    setError('');
  }, []);

  const getActiveScenario = () => {
    const hasRange = rangeStartDate || rangeStartTime || rangeEndDate || rangeEndTime;
    if (hasRange) return '3';
    if (meetingDate && meetingStartTime) return '4';
    if (meetingDate) return '2';
    return '1';
  };

  const activeScenario = getActiveScenario();
  const scenarioLabel = {
    1: 'Сц. 1 (Авто)',
    2: 'Сц. 2 (День)',
    3: 'Сц. 3 (Діапазон)',
    4: 'Сц. 4 (Точний час)'
  }[activeScenario];

  useEffect(() => {
    if (isOpen) {
      resetFormState();
      fetchLists();
    } else {
      resetFormState();
    }
  }, [isOpen, resetFormState]);

  useEffect(() => {
    if (isOpen) {
      setParticipants({ [currentUserId]: 'required' });
    }
  }, [isOpen, currentUserId]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const fetchLists = async () => {
    try {
      const [u, r, p] = await Promise.all([
        api.get('/users/'), api.get('/resources/'), api.get('/projects/')
      ]);
      setAllUsers(u.data);
      setAvailableUsers(u.data);
      setAvailableResources(r.data);
      setAvailableProjects(p.data);
    } catch (err) {
      setError('Помилка завантаження довідників.');
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (!allUsers.length) return;

    const projectId = Number(selectedProject);
    if (!projectId || projectId === 1) {
      setAvailableUsers(allUsers);
      return;
    }

    let cancelled = false;
    const fetchProjectMembers = async () => {
      try {
        setError('');
        const res = await api.get(`/projects/${projectId}/members`);
        if (!cancelled) {
          setAvailableUsers(res.data);
        }
      } catch (err) {
        if (!cancelled) {
          setAvailableUsers([]);
          setError('Помилка завантаження учасників проєкту.');
        }
      }
    };

    fetchProjectMembers();

    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedProject, allUsers]);

  useEffect(() => {
    if (!isOpen) return;
    const allowedIds = new Set(availableUsers.map(u => Number(u.id)));

    setParticipants(prev => {
      const next = {};
      Object.entries(prev).forEach(([id, type]) => {
        const numId = Number(id);
        const isOrganizer = Number(currentUserId) === numId;
        if (!type || type === 'none') return;
        if (isOrganizer || allowedIds.has(numId)) {
          next[numId] = type;
        }
      });

      if (currentUserId) {
        next[currentUserId] = 'required';
      }

      return next;
    });
  }, [availableUsers, currentUserId, isOpen]);

  const buildParticipantsPayload = () => {
    const allowedIds = new Set(availableUsers.map(u => Number(u.id)));
    return Object.entries(participants)
      .filter(([id, type]) => {
        const numId = Number(id);
        const isOrganizer = Number(currentUserId) === numId;
        return type && type !== 'none' && (isOrganizer || allowedIds.has(numId));
      })
      .map(([id, type]) => ({
        id: Number(id),
        weight: type === 'required' ? 1000000 : 10
      }));
  };

  const handleAction = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSlots([]);
    setValidationResult(null);
    setValidatedSlot(null);

    const durationMinutes = Number(duration);
    const scenario = getActiveScenario();
    let startDate;
    let endDate;

    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      setError('Вкажіть коректну тривалість зустрічі.');
      setLoading(false);
      return;
    }

    // Логіка сценаріїв для формування часових меж
    if (scenario === '1') {
      const now = new Date();
      startDate = now;
      endDate = new Date(now);
      endDate.setDate(now.getDate() + 7);
    } else if (scenario === '2') {
      if (!meetingDate) {
        setError('Для сценарію 2 оберіть дату зустрічі.');
        setLoading(false);
        return;
      }
      startDate = new Date(`${meetingDate}T09:00`);
      endDate = new Date(`${meetingDate}T18:00`);
    } else if (scenario === '3') {
      if (!rangeStartDate || !rangeStartTime || !rangeEndDate || !rangeEndTime) {
        setError('Для сценарію 3 заповніть початок і кінець діапазону.');
        setLoading(false);
        return;
      }
      startDate = new Date(`${rangeStartDate}T${rangeStartTime}`);
      endDate = new Date(`${rangeEndDate}T${rangeEndTime}`);
    } else if (scenario === '4') {
      if (!meetingDate || !meetingStartTime) {
        setError('Для сценарію 4 оберіть дату і час початку.');
        setLoading(false);
        return;
      }
      startDate = new Date(`${meetingDate}T${meetingStartTime}`);
      endDate = new Date(startDate);
      endDate.setMinutes(startDate.getMinutes() + durationMinutes);
    }

    if (!startDate || !endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setError('Перевірте коректність дати та часу.');
      setLoading(false);
      return;
    }

    if (endDate <= startDate) {
      setError('Час закінчення має бути пізніше за початок.');
      setLoading(false);
      return;
    }

    const finalStart = startDate.toISOString();
    const finalEnd = endDate.toISOString();

    // Спільні масиви користувачів та ресурсів
    const mappedUsers = buildParticipantsPayload();
    const mappedResources = Object.entries(resources).map(([id, type]) => ({ 
      id: Number(id), weight: type === 'required' ? 1000000 : 10 
    }));

    try {
      if (scenario === '4') {
        // payload для validate-slot (Сценарій 4)
        const validatePayload = {
          start_time: finalStart,
          end_time: finalEnd,
          users: mappedUsers,
          resources: mappedResources
        };
        const res = await api.post('/meetings/validate-slot', validatePayload);
        setValidationResult(res.data);
        setValidatedSlot({ start_time: finalStart, end_time: finalEnd });
      } else {
        // payload для find-slots (Сценарії 1, 2, 3)
        const findPayload = {
          duration_minutes: durationMinutes,
          search_start: finalStart,
          search_end: finalEnd,
          users: mappedUsers,
          resources: mappedResources
        };
        const res = await api.post('/meetings/find-slots', findPayload);
        setSlots(res.data);
      }
    } catch (err) {
      console.error(err);
      setError('Помилка обробки запиту. Перевірте введені дані.');
    } finally {
      setLoading(false);
    }
  };

  const bookMeeting = async (slot) => {
    try {
      const payload = {
        title, description, project_id: selectedProject, frequency,
        start_time: slot.start_time, end_time: slot.end_time,
        participants: buildParticipantsPayload(),
        resources: Object.entries(resources).map(([id, type]) => ({ id: Number(id), weight: type === 'required' ? 1000000 : 10 }))
      };
      await api.post('/meetings/', payload);
      onSuccess(); onClose();
    } catch (err) { setError('Помилка бронювання'); }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-card-lg">
        <h2 className="modal-title">Планування зустрічі</h2>
        <div className="result-box">
          <strong>Активний сценарій: {scenarioLabel}</strong>
          <p>
            Підказка: лише учасники -{'>'} Сц. 1; лише дата -{'>'} Сц. 2; дата + час -{'>'} Сц. 4; діапазон -{'>'} Сц. 3.
          </p>
        </div>

        <form onSubmit={handleAction} className="form-stack">
          <input type="text" placeholder="Назва" required value={title} onChange={e => setTitle(e.target.value)} className="form-control" />
          <textarea placeholder="Опис або посилання на зустріч" value={description} onChange={e => setDescription(e.target.value)} className="form-control form-textarea" />
          
          <div className="form-row">
             <div className="form-field">
                <label className="form-label">Проєкт:</label>
                <select value={selectedProject} onChange={e => setSelectedProject(Number(e.target.value))} className="form-control">
                  {availableProjects.map(p => <option key={p.id} value={p.id}>{p.id === 1 ? "Без проєкту" : p.name}</option>)}
                </select>
             </div>
             <div className="form-field">
                <label className="form-label">Повторення:</label>
                <select value={frequency} onChange={e => setFrequency(e.target.value)} className="form-control">
                  <option value="once">Один раз</option>
                  <option value="daily">Щодня</option>
                  <option value="weekly">Щотижня</option>
                </select>
             </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Бажана дата:</label>
              <input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} className="form-control" />
            </div>
            <div className="form-field">
              <label className="form-label">Час початку:</label>
              <input type="time" value={meetingStartTime} onChange={e => setMeetingStartTime(e.target.value)} className="form-control" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Початок діапазону (дата):</label>
              <input type="date" value={rangeStartDate} onChange={e => setRangeStartDate(e.target.value)} className="form-control" />
            </div>
            <div className="form-field">
              <label className="form-label">Початок діапазону (час):</label>
              <input type="time" value={rangeStartTime} onChange={e => setRangeStartTime(e.target.value)} className="form-control" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Кінець діапазону (дата):</label>
              <input type="date" value={rangeEndDate} onChange={e => setRangeEndDate(e.target.value)} className="form-control" />
            </div>
            <div className="form-field">
              <label className="form-label">Кінець діапазону (час):</label>
              <input type="time" value={rangeEndTime} onChange={e => setRangeEndTime(e.target.value)} className="form-control" />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Тривалість (хв):</label>
            <input type="number" step="15" value={duration} onChange={e => setDuration(e.target.value)} className="form-control" />
          </div>

          <div className="list-grid">
            <div className="list-panel">
              <strong>Учасники:</strong>
              {availableUsers.map(u => (
                <div key={u.id} className="list-item">
                  <span>{u.full_name || u.email}</span>
                  {u.id === currentUserId ? <span className="badge-success">Орг.</span> : 
                    <select
                      onChange={e => {
                        const value = e.target.value;
                        setParticipants(prev => {
                          const next = { ...prev };
                          if (value === 'none') {
                            delete next[u.id];
                          } else {
                            next[u.id] = value;
                          }
                          return next;
                        });
                      }}
                      className="mini-select"
                    >
                      <option value="none">-</option>
                      <option value="required">Обов.</option>
                      <option value="optional">Опц.</option>
                    </select>
                  }
                </div>
              ))}
            </div>
            <div className="list-panel">
              <strong>Ресурси/Кімнати:</strong>
              {availableResources.map(r => (
                <div key={r.id} className="list-item">
                  <span>{r.name}</span>
                  <select onChange={e => setResources({...resources, [r.id]: e.target.value})} className="mini-select">
                    <option value="none">-</option>
                    <option value="required">Обов.</option>
                    <option value="optional">Опц.</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" disabled={loading} className="btn btn-primary btn-grow">
              {loading ? 'Аналізуємо розклад...' : (activeScenario === '4' ? 'Перевірити час' : 'Знайти вільні слоти')}
            </button>
            
            <button 
              type="button" 
              onClick={onClose} 
              className="btn btn-muted"
            >
              Скасувати
            </button>
          </div>
        </form>

        {error && <div className="text-danger">{error}</div>}

        {/* Результати Сценарію 4 */}
        {validationResult && (
          <div className="result-box">
            <h4>Результат валідації:</h4>
            {validationResult.is_valid ? 
              <p className="text-success">✅ Час вільний! Штраф: {validationResult.score}</p> :
              <div className="text-danger">
                <p>❌ Конфлікти (Штраф: {validationResult.score}):</p>
                <ul>{validationResult.conflicts.map((c, i) => <li key={i}>{c}</li>)}</ul>
              </div>
            }
            <button onClick={() => validatedSlot && bookMeeting(validatedSlot)} 
                    className={validationResult.is_valid ? "btn btn-success btn-block" : "btn btn-warning btn-block"}>
              {validationResult.is_valid ? "Забронювати" : "Забронювати попри конфлікти"}
            </button>
          </div>
        )}

        {/* Результати Сценаріїв 1-3 */}
        {slots.length > 0 && (
          <div className="result-box">
            <h4>Рекомендовані слоти:</h4>
            {slots.map((s, i) => (
              <div key={i} className="slot-item">
                <span>{new Date(s.start_time).toLocaleString('uk-UA')}</span>
                <button onClick={() => bookMeeting(s)} className="btn btn-success btn-sm">Обрати</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScheduleModal;
