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
      // searchStart тут - це дата обрана користувачем
      const day = new Date(searchStart);
      day.setHours(9, 0, 0, 0);
      finalStart = day.toISOString();
      day.setHours(18, 0, 0, 0);
      finalEnd = day.toISOString();
    }

    const payload = {
      title, description, duration: Number(duration), frequency,
      start_time: finalStart, end_time: finalEnd,
      users: Object.entries(participants).map(([id, type]) => ({ id: Number(id), weight: type === 'required' ? 1000000 : 10 })),
      resources: Object.entries(resources).map(([id, type]) => ({ id: Number(id), weight: type === 'required' ? 1000000 : 10 }))
    };

    try {
      if (scenario === '4') {
        const res = await api.post('/meetings/validate-slot', payload);
        setValidationResult(res.data);
      } else {
        const res = await api.post('/meetings/find-slots', payload);
        setSlots(res.data);
      }
    } catch (err) {
      setError('Помилка обробки запиту');
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
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2>Планування зустрічі</h2>
        
        <div style={tabsStyle}>
          <button onClick={() => setScenario('1')} style={scenario === '1' ? activeTab : tab}>Сц. 1 (Авто)</button>
          <button onClick={() => setScenario('2')} style={scenario === '2' ? activeTab : tab}>Сц. 2 (День)</button>
          <button onClick={() => setScenario('3')} style={scenario === '3' ? activeTab : tab}>Сц. 3 (Діапазон)</button>
          <button onClick={() => setScenario('4')} style={scenario === '4' ? activeTab : tab}>Сц. 4 (Точний час)</button>
        </div>

        <form onSubmit={handleAction} style={formStyle}>
          <input type="text" placeholder="Назва" required value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
          <textarea placeholder="Опис або посилання на зустріч" value={description} onChange={e => setDescription(e.target.value)} style={{...inputStyle, height: '60px'}} />
          
          <div style={{display: 'flex', gap: '10px'}}>
             <div style={{flex: 1}}>
                <label>Проєкт:</label>
                <select value={selectedProject} onChange={e => setSelectedProject(Number(e.target.value))} style={inputStyle}>
                  {availableProjects.map(p => <option key={p.id} value={p.id}>{p.id === 1 ? "Без проєкту" : p.name}</option>)}
                </select>
             </div>
             <div style={{flex: 1}}>
                <label>Повторення:</label>
                <select value={frequency} onChange={e => setFrequency(e.target.value)} style={inputStyle}>
                  <option value="once">Один раз</option>
                  <option value="daily">Щодня</option>
                  <option value="weekly">Щотижня</option>
                </select>
             </div>
          </div>

          {/* Динамічні поля дат залежно від сценарію */}
          {scenario !== '1' && (
            <div style={{display: 'flex', gap: '10px'}}>
              <div style={{flex: 1}}>
                <label>{scenario === '2' ? 'Обрати дату:' : 'Початок пошуку:'}</label>
                <input type={scenario === '2' ? "date" : "datetime-local"} required value={searchStart} onChange={e => setSearchStart(e.target.value)} style={inputStyle} />
              </div>
              {scenario === '3' && (
                <div style={{flex: 1}}>
                  <label>Кінець пошуку:</label>
                  <input type="datetime-local" required value={searchEnd} onChange={e => setSearchEnd(e.target.value)} style={inputStyle} />
                </div>
              )}
              {scenario === '4' && (
                <div style={{flex: 1}}>
                  <label>Час закінчення:</label>
                  <input type="datetime-local" required value={searchEnd} onChange={e => setSearchEnd(e.target.value)} style={inputStyle} />
                </div>
              )}
            </div>
          )}

          {scenario !== '4' && (
            <div>
              <label>Тривалість (хв):</label>
              <input type="number" step="15" value={duration} onChange={e => setDuration(e.target.value)} style={inputStyle} />
            </div>
          )}

          <div style={listsContainer}>
            <div style={listStyle}>
              <strong>Учасники:</strong>
              {availableUsers.map(u => (
                <div key={u.id} style={listItem}>
                  <span>{u.full_name || u.email}</span>
                  {u.id === currentUserId ? <span style={{color: 'green'}}>Орг.</span> : 
                    <select onChange={e => setParticipants({...participants, [u.id]: e.target.value})} style={miniSelect}>
                      <option value="none">-</option>
                      <option value="required">Обов.</option>
                      <option value="optional">Опц.</option>
                    </select>
                  }
                </div>
              ))}
            </div>
            <div style={listStyle}>
              <strong>Ресурси/Кімнати:</strong>
              {availableResources.map(r => (
                <div key={r.id} style={listItem}>
                  <span>{r.name}</span>
                  <select onChange={e => setResources({...resources, [r.id]: e.target.value})} style={miniSelect}>
                    <option value="none">-</option>
                    <option value="required">Обов.</option>
                    <option value="optional">Опц.</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading} style={{ ...primaryBtnStyle, flex: 2 }}>
            {loading ? 'Аналізуємо розклад...' : (scenario === '4' ? 'Перевірити час' : 'Знайти вільні слоти')}
          </button>
          
          <button 
            type="button" 
            onClick={onClose} 
            style={{ ...tab, flex: 1, backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            Скасувати
          </button>
        </form>

        {/* Результати Сценарію 4 */}
        {validationResult && (
          <div style={resultBox}>
            <h4>Результат валідації:</h4>
            {validationResult.is_valid ? 
              <p style={{color: 'green'}}>✅ Час вільний! Штраф: {validationResult.score}</p> :
              <div style={{color: 'red'}}>
                <p>❌ Конфлікти (Штраф: {validationResult.score}):</p>
                <ul>{validationResult.conflicts.map((c, i) => <li key={i}>{c}</li>)}</ul>
              </div>
            }
            <button onClick={() => bookMeeting({start_time: searchStart, end_time: searchEnd})} 
                    style={validationResult.is_valid ? successBtnStyle : warningBtnStyle}>
              {validationResult.is_valid ? "Забронювати" : "Забронювати попри конфлікти"}
            </button>
          </div>
        )}

        {/* Результати Сценаріїв 1-3 */}
        {slots.length > 0 && (
          <div style={resultBox}>
            <h4>Рекомендовані слоти:</h4>
            {slots.map((s, i) => (
              <div key={i} style={slotItem}>
                <span>{new Date(s.start_time).toLocaleString('uk-UA')}</span>
                <button onClick={() => bookMeeting(s)} style={miniSuccessBtn}>Обрати</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Стилі (спрощено)
const overlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalStyle = { backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '600px', maxHeight: '90vh', overflowY: 'auto' };
const tabsStyle = { display: 'flex', gap: '5px', marginBottom: '15px' };
const tab = { padding: '5px 10px', cursor: 'pointer', border: '1px solid #ccc', background: '#f0f0f0' };
const activeTab = { ...tab, background: '#007bff', color: 'white', borderColor: '#0056b3' };
const formStyle = { display: 'flex', flexDirection: 'column', gap: '10px' };
const inputStyle = { padding: '8px', border: '1px solid #ccc', borderRadius: '4px' };
const listsContainer = { display: 'flex', gap: '10px' };
const listStyle = { flex: 1, border: '1px solid #eee', padding: '5px', maxHeight: '150px', overflowY: 'auto' };
const listItem = { display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' };
const miniSelect = { fontSize: '10px' };
const primaryBtnStyle = { padding: '10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' };
const resultBox = { marginTop: '15px', padding: '10px', borderTop: '2px solid #007bff', background: '#f9f9f9' };
const slotItem = { display: 'flex', justifyContent: 'space-between', padding: '5px', borderBottom: '1px solid #eee' };
const successBtnStyle = { padding: '10px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', width: '100%' };
const warningBtnStyle = { ...successBtnStyle, background: '#ffc107', color: 'black' };
const miniSuccessBtn = { background: '#28a745', color: 'white', border: 'none', padding: '2px 5px', borderRadius: '3px', cursor: 'pointer' };

export default ScheduleModal;
