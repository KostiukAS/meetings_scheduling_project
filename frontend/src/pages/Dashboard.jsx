import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import api from '../api/axios';
import ScheduleModal from '../components/ScheduleModal';

const Dashboard = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  
  // ДОДАНО: Стан для контролю модального вікна
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchMeetings = async () => {
    try {
      const response = await api.get('/meetings/');
      const formattedEvents = response.data.map(meeting => ({
        id: meeting.id,
        title: meeting.title,
        start: meeting.start_time,
        end: meeting.end_time,
        backgroundColor: '#3788d8',
      }));
      setEvents(formattedEvents);
    } catch (error) {
      if (error.response?.status === 401) {
        handleLogout();
      }
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Мій розклад</h1>
        <div>
          {/* ЗМІНЕНО: Кнопка тепер відкриває модальне вікно */}
          <button 
            onClick={() => setIsModalOpen(true)} 
            style={{ padding: '10px 20px', marginRight: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + Запланувати зустріч
          </button>
          
          <button onClick={handleLogout} style={{ padding: '10px 20px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Вийти
          </button>
        </div>
      </header>

      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          slotMinTime="08:00:00"
          slotMaxTime="20:00:00"
          allDaySlot={false}
          events={events}
          height="auto"
        />
      </div>

      {/* ДОДАНО: Компонент модального вікна */}
      <ScheduleModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchMeetings} // Після успішного бронювання календар оновиться
      />
    </div>
  );
};

export default Dashboard;
