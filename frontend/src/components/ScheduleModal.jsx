import React, { useState, useEffect } from 'react';
import api from '../api/axios';

const ScheduleModal = ({ isOpen, onClose, onSuccess, currentUserId }) => {
  const [scenario, setScenario] = useState('1'); // 1, 2, 3, 4
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(60);
  const [frequency, setFrequency] = useState('once');
  
  // Дати для пошуку
  const [searchStart, setSearchStart] = useState('');
  const [searchEnd, setSearchEnd] = useState('');
  
  const [availableUsers, setAvailableUsers] = useState([]);
  const [availableResources, setAvailableResources] = useState([]);
  const [availableProjects, setAvailableProjects] = useState([]);
  
  const [participants, setParticipants] = useState({});
  const [resources, setResources] = useState({});
  const [selectedProject, setSelectedProject] = useState(1);

  const [slots, setSlots] = useState([]);
  const [validationResult, setValidationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchLists();
      setParticipants({ [currentUserId]: 'required' });
      setScenario('1');
    }
  }, [isOpen, currentUserId]);

  const fetchLists = async () => {
    const [u, r, p] = await Promise.all([
      api.get('/users/'), api.get('/resources/'), api.get('/projects/')
    ]);
    setAvailableUsers(u.data);
    setAvailableResources(r.data);
    setAvailableProjects(p.data);
  };

  const handleAction = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSlots([]);
    setValidationResult(null);

    let finalStart = searchStart;
    let finalEnd = searchEnd;

    // Логіка сценаріїв для формування часових меж
    const now = new Date();
    if (scenario === '1') {
      finalStart = now.toISOString();
      const weekLater = new Date();
      weekLater.setDate(now.getDate() + 7);
      finalEnd = weekLater.toISOString();
    } else if (scenario === '2') {
      const day = new Date(searchStart);
      day.setHours(9, 0, 0, 0);
      finalStart = day.toISOString();
      day.setHours(18, 0, 0, 0);
      finalEnd = day.toISOString();
    }

    // Спільні масиви користувачів та ресурсів
    const mappedUsers = Object.entries(participants).map(([id, type]) => ({ 
      id: Number(id), weight: type === 'required' ? 1000000 : 10 
    }));
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
      } else {
        // payload для find-slots (Сценарії 1, 2, 3)
        const findPayload = {
          duration_minutes: Number(duration),
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
        participants: Object.entries(participants).map(([id, type]) => ({ id: Number(id), weight: type === 'required' ? 1000000 : 10 })),
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
        
        <div className="modal-tabs">
          <button onClick={() => setScenario('1')} className={scenario === '1' ? "tab-button is-active" : "tab-button"}>Сц. 1 (Авто)</button>
          <button onClick={() => setScenario('2')} className={scenario === '2' ? "tab-button is-active" : "tab-button"}>Сц. 2 (День)</button>
          <button onClick={() => setScenario('3')} className={scenario === '3' ? "tab-button is-active" : "tab-button"}>Сц. 3 (Діапазон)</button>
          <button onClick={() => setScenario('4')} className={scenario === '4' ? "tab-button is-active" : "tab-button"}>Сц. 4 (Точний час)</button>
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

          {/* Динамічні поля дат залежно від сценарію */}
          {scenario !== '1' && (
            <div className="form-row">
              <div className="form-field">
                <label className="form-label">{scenario === '2' ? 'Обрати дату:' : 'Початок пошуку:'}</label>
                <input type={scenario === '2' ? "date" : "datetime-local"} required value={searchStart} onChange={e => setSearchStart(e.target.value)} className="form-control" />
              </div>
              {scenario === '3' && (
                <div className="form-field">
                  <label className="form-label">Кінець пошуку:</label>
                  <input type="datetime-local" required value={searchEnd} onChange={e => setSearchEnd(e.target.value)} className="form-control" />
                </div>
              )}
              {scenario === '4' && (
                <div className="form-field">
                  <label className="form-label">Час закінчення:</label>
                  <input type="datetime-local" required value={searchEnd} onChange={e => setSearchEnd(e.target.value)} className="form-control" />
                </div>
              )}
            </div>
          )}

          {scenario !== '4' && (
            <div className="form-field">
              <label className="form-label">Тривалість (хв):</label>
              <input type="number" step="15" value={duration} onChange={e => setDuration(e.target.value)} className="form-control" />
            </div>
          )}

          <div className="list-grid">
            <div className="list-panel">
              <strong>Учасники:</strong>
              {availableUsers.map(u => (
                <div key={u.id} className="list-item">
                  <span>{u.full_name || u.email}</span>
                  {u.id === currentUserId ? <span className="badge-success">Орг.</span> : 
                    <select onChange={e => setParticipants({...participants, [u.id]: e.target.value})} className="mini-select">
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
              {loading ? 'Аналізуємо розклад...' : (scenario === '4' ? 'Перевірити час' : 'Знайти вільні слоти')}
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
            <button onClick={() => bookMeeting({start_time: searchStart, end_time: searchEnd})} 
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
