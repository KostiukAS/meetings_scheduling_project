import React, { useState } from 'react';
import api from '../api/axios';

const ScheduleModal = ({ isOpen, onClose, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(60);
  const [searchStart, setSearchStart] = useState('');
  const [searchEnd, setSearchEnd] = useState('');
  
  // ДОДАНО: Стан для динамічних ID учасника та ресурсу
  const [participantId, setParticipantId] = useState(3); 
  const [resourceId, setResourceId] = useState(1);

  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleFindSlots = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSlots([]);

    try {
      const payload = {
        duration_minutes: Number(duration),
        search_start: new Date(searchStart).toISOString(),
        search_end: new Date(searchEnd).toISOString(),
        // ЗМІНЕНО: Тепер беремо ID зі стану форми
        users: [{ id: Number(participantId), weight: 100 }], 
        resources: [{ id: Number(resourceId), weight: 10 }]
      };

      const response = await api.post('/meetings/find-slots', payload);
      setSlots(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не вдалося знайти вільний час у цьому діапазоні.');
    } finally {
      setLoading(false);
    }
  };

  const handleBookSlot = async (slot) => {
    try {
      const payload = {
        title: title || 'Нова зустріч',
        start_time: slot.start_time,
        end_time: slot.end_time,
        project_id: 1, 
        // ЗМІНЕНО: Тепер беремо ID зі стану форми для запису в БД
        participants: [{ id: Number(participantId), weight: 100 }],
        resources: [{ id: Number(resourceId), weight: 10 }]
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
          <input 
            type="text" placeholder="Назва зустрічі" required
            value={title} onChange={(e) => setTitle(e.target.value)}
            style={inputStyle}
          />
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <label>ID Учасника:</label>
              <input 
                type="number" required
                value={participantId} onChange={(e) => setParticipantId(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label>ID Кімнати:</label>
              <input 
                type="number" required
                value={resourceId} onChange={(e) => setResourceId(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label>Тривалість (хвилин): </label>
            <select value={duration} onChange={(e) => setDuration(e.target.value)} style={inputStyle}>
              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={45}>45</option>
              <option value={60}>60 (1 година)</option>
              <option value={90}>90 (1.5 години)</option>
              <option value={120}>120 (2 години)</option>
            </select>
          </div>

          <div>
            <label>Шукати з: </label>
            <input 
              type="datetime-local" required
              value={searchStart} onChange={(e) => setSearchStart(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label>Шукати до: </label>
            <input 
              type="datetime-local" required
              value={searchEnd} onChange={(e) => setSearchEnd(e.target.value)}
              style={inputStyle}
            />
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
                const startStr = new Date(slot.start_time).toLocaleString('uk-UA');
                const endStr = new Date(slot.end_time).toLocaleTimeString('uk-UA');
                
                return (
                  <li key={index} style={slotItemStyle}>
                    <div>
                      <strong>{startStr} - {endStr}</strong>
                      <div style={{ fontSize: '12px', color: '#666' }}>Штраф: {slot.score}</div>
                    </div>
                    <button onClick={() => handleBookSlot(slot)} style={successBtnStyle}>
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
const modalStyle = { backgroundColor: 'white', padding: '25px', borderRadius: '8px', width: '450px', maxHeight: '90vh', overflowY: 'auto' };
const closeBtnStyle = { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' };
const inputStyle = { width: '100%', padding: '8px', marginTop: '5px', boxSizing: 'border-box' };
const primaryBtnStyle = { backgroundColor: '#007bff', color: 'white', padding: '10px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' };
const successBtnStyle = { backgroundColor: '#28a745', color: 'white', padding: '8px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer' };
const slotItemStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f9fa', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ddd' };

export default ScheduleModal;
