import React, { useState, useEffect } from 'react';
import api from '../api/axios';

// ЗМІНЕНО: Тепер приймаємо currentUserId як пропсу
const ScheduleModal = ({ isOpen, onClose, onSuccess, currentUserId }) => {
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(60);
  const [searchStart, setSearchStart] = useState('');
  const [searchEnd, setSearchEnd] = useState('');

  const [availableUsers, setAvailableUsers] = useState([]);
  const [availableResources, setAvailableResources] = useState([]);
  const [availableProjects, setAvailableProjects] = useState([]); // ДОДАНО
  const [frequency, setFrequency] = useState('once');

  const [participants, setParticipants] = useState({});
  const [resources, setResources] = useState({});
  const [selectedProject, setSelectedProject] = useState(1); // ДОДАНО: 1 = Без проєкту

  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchLists();
      // Організатор (currentUserId) одразу стає обов'язковим учасником
      if (currentUserId) {
        setParticipants({ [currentUserId]: 'required' });
      }
      setResources({});
      setSelectedProject(1); // Скидаємо проєкт на "Без проєкту"
    } else {
      setSlots([]);
      setError('');
      setTitle('');
    }
  }, [isOpen, currentUserId]);

  const fetchLists = async () => {
    try {
      const usersRes = await api.get('/users/');
      const resourcesRes = await api.get('/resources/'); 
      const projectsRes = await api.get('/projects/'); // ДОДАНО
      setAvailableUsers(usersRes.data);
      setAvailableResources(resourcesRes.data);
      setAvailableProjects(projectsRes.data);
    } catch (err) {
      console.error("Помилка завантаження списків", err);
    }
  };

  const handleParticipantChange = (id, value) => {
    // Організатора змінити не можна
    if (id === currentUserId) return; 

    setParticipants(prev => {
      const newState = { ...prev };
      if (value === 'none') {
        delete newState[id];
      } else {
        newState[id] = value;
      }
      return newState;
    });
  };

  const handleResourceChange = (id, value) => {
    setResources(prev => {
      const newState = { ...prev };
      if (value === 'none') delete newState[id];
      else newState[id] = value;
      return newState;
    });
  };

  const buildPayloadArrays = () => {
    const users = Object.entries(participants).map(([id, type]) => ({
      id: Number(id),
      weight: type === 'required' ? 1000000 : 10
    }));
    
    const resPayload = Object.entries(resources).map(([id, type]) => ({
      id: Number(id),
      weight: type === 'required' ? 1000000 : 10
    }));

    return { users, resources: resPayload };
  };

  if (!isOpen) return null;

  const handleFindSlots = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSlots([]);

    try {
      const { users, resources: resPayload } = buildPayloadArrays();

      const payload = {
        duration_minutes: Number(duration),
        search_start: new Date(searchStart).toISOString(),
        search_end: new Date(searchEnd).toISOString(),
        users: users,
        resources: resPayload
      };

      const response = await api.post('/meetings/find-slots', payload);
      setSlots(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не вдалося знайти вільний час.');
    } finally {
      setLoading(false);
    }
  };

  const handleBookSlot = async (slot) => {
    try {
      const { users, resources: resPayload } = buildPayloadArrays();

      const payload = {
        title: title || 'Нова зустріч',
        start_time: slot.start_time,
        end_time: slot.end_time,
        frequency: frequency,
        project_id: selectedProject, // ЗМІНЕНО: Використовуємо вибраний проєкт
        participants: users,
        resources: resPayload
      };

      await api.post('/meetings/', payload);
      onSuccess(); 
      onClose();   
    } catch (err) {
      setError('Помилка під час бронювання зустрічі.');
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Розумне планування</h2>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>
        
        <form onSubmit={handleFindSlots} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 2 }}>
              <label>Назва зустрічі:</label>
              <input type="text" placeholder="Наприклад: Обговорення дизайну" required value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
            </div>
            
            {/* ДОДАНО: Вибір проєкту */}
            <div style={{ flex: 1 }}>
              <label>Проєкт:</label>
              <select value={selectedProject} onChange={(e) => setSelectedProject(Number(e.target.value))} style={inputStyle}>
                <option value={1}>Без проєкту</option>
                {/* Фільтруємо проєкт з ID=1, щоб не дублювати його у списку */}
                {availableProjects.filter(p => p.id !== 1).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px' }}>
            {/* Список учасників */}
            <div style={{ flex: 1, border: '1px solid #ccc', padding: '10px', borderRadius: '4px', maxHeight: '200px', overflowY: 'auto' }}>
              <strong style={{ display: 'block', marginBottom: '10px' }}>Учасники:</strong>
              {availableUsers.map(user => {
                const isOrganizer = user.id === currentUserId;
                return (
                  <div key={user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '14px' }}>
                    <span style={{ fontWeight: isOrganizer ? 'bold' : 'normal' }}>
                      {user.email} {isOrganizer && '👑'}
                    </span>
                    {isOrganizer ? (
                      <span style={{ color: '#28a745', fontSize: '12px', fontWeight: 'bold' }}>Організатор</span>
                    ) : (
                      <select 
                        value={participants[user.id] || 'none'} 
                        onChange={(e) => handleParticipantChange(user.id, e.target.value)}
                        style={{ padding: '2px', fontSize: '12px' }}
                      >
                        <option value="none">Не бере участь</option>
                        <option value="required">Обов'язково</option>
                        <option value="optional">Опціонально</option>
                      </select>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Список кімнат */}
            <div style={{ flex: 1, border: '1px solid #ccc', padding: '10px', borderRadius: '4px', maxHeight: '200px', overflowY: 'auto' }}>
              <strong style={{ display: 'block', marginBottom: '10px' }}>Кімнати:</strong>
              {availableResources.map(res => (
                <div key={res.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '14px' }}>
                  <span>{res.name}</span>
                  <select 
                    value={resources[res.id] || 'none'} 
                    onChange={(e) => handleResourceChange(res.id, e.target.value)}
                    style={{ padding: '2px', fontSize: '12px' }}
                  >
                    <option value="none">Не потрібна</option>
                    <option value="required">Обов'язково</option>
                    <option value="optional">Опціонально</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label>Тривалість: </label>
            <select value={duration} onChange={(e) => setDuration(e.target.value)} style={inputStyle}>
              <option value={15}>15 хв</option>
              <option value={30}>30 хв</option>
              <option value={60}>1 година</option>
              <option value={120}>2 години</option>
            </select>
          </div>

          <div>
            <label>Частота зустрічі: </label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)} style={inputStyle}>
              <option value="once">Одноразова</option>
              <option value="daily">Щодня</option>
              <option value="weekly">Раз на тиждень</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <label>Шукати з: </label>
              <input type="datetime-local" required value={searchStart} onChange={(e) => setSearchStart(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Шукати до: </label>
              <input type="datetime-local" required value={searchEnd} onChange={(e) => setSearchEnd(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <button type="submit" disabled={loading} style={primaryBtnStyle}>
            {loading ? 'Аналізуємо розклад...' : 'Знайти час'}
          </button>
        </form>

        {error && <p style={{ color: 'red', marginTop: '15px' }}>{error}</p>}

        {slots.length > 0 && (
          <div style={{ marginTop: '20px', borderTop: '1px solid #ccc', paddingTop: '15px' }}>
            <h3>Знайдені слоти (ТОП-5):</h3>
            <ul style={{ listStyleType: 'none', padding: 0 }}>
              {slots.map((slot, index) => {
                const utcStartStr = slot.start_time.endsWith('Z') ? slot.start_time : `${slot.start_time}Z`;
                const utcEndStr = slot.end_time.endsWith('Z') ? slot.end_time : `${slot.end_time}Z`;

                const startStr = new Date(utcStartStr).toLocaleString('uk-UA');
                const endStr = new Date(utcEndStr).toLocaleTimeString('uk-UA');
                
                return (
                  <li key={index} style={slotItemStyle}>
                    <div>
                      <strong>{startStr} - {endStr}</strong>
                      <div style={{ fontSize: '12px', color: '#666' }}>Штраф: {slot.score}</div>
                    </div>
                    <button onClick={() => handleBookSlot({ ...slot, start_time: utcStartStr, end_time: utcEndStr })} style={successBtnStyle}>
                      Забронювати
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

const overlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalStyle = { backgroundColor: 'white', padding: '25px', borderRadius: '8px', width: '650px', maxHeight: '95vh', overflowY: 'auto' };
const closeBtnStyle = { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' };
const inputStyle = { width: '100%', padding: '8px', marginTop: '5px', boxSizing: 'border-box' };
const primaryBtnStyle = { backgroundColor: '#007bff', color: 'white', padding: '10px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' };
const successBtnStyle = { backgroundColor: '#28a745', color: 'white', padding: '8px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer' };
const slotItemStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f9fa', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ddd' };

export default ScheduleModal;
