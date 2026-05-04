import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import api from '../api/axios';
import ScheduleModal from '../components/ScheduleModal';
import MeetingDetailsModal from '../components/MeetingDetailsModal'; 

const Dashboard = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);

  // ДОДАНО: Стан для зберігання поточного користувача
  const [currentUser, setCurrentUser] = useState(null);

  // ДОДАНО: Функція для отримання профілю користувача
  const fetchCurrentUser = async () => {
    try {
      const response = await api.get('/users/me');
      setCurrentUser(response.data);
    } catch (error) {
      if (error.response?.status === 401) handleLogout();
    }
  };

  const fetchMeetings = async (userId) => {
    try {
      const response = await api.get('/meetings/');
      const formattedEvents = response.data.map(meeting => {
        const startUTC = meeting.start_time.endsWith('Z') ? meeting.start_time : `${meeting.start_time}Z`;
        const endUTC = meeting.end_time.endsWith('Z') ? meeting.end_time : `${meeting.end_time}Z`;

        return {
          id: meeting.id,
          title: meeting.title,
          start: startUTC,
          end: endUTC,
          backgroundColor: meeting.organizer_id === userId ? '#28a745' : '#3788d8', // ЗМІНЕНО: Використовуємо динамічний ID
          extendedProps: { organizer_id: meeting.organizer_id }
        };
      });
      setEvents(formattedEvents);
    } catch (error) {
      if (error.response?.status === 401) handleLogout();
    }
  };

  useEffect(() => {
    // ЗМІНЕНО: Спочатку отримуємо користувача, потім його зустрічі
    fetchCurrentUser().then(() => {
      // Виклик fetchMeetings відбудеться після оновлення стейту через useEffect нижче
    });
  }, []);

  // ДОДАНО: Завантажуємо зустрічі лише тоді, коли знаємо, хто такий currentUser
  useEffect(() => {
    if (currentUser) {
      fetchMeetings(currentUser.id);
    }
  }, [currentUser]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleEventClick = (clickInfo) => {
    setSelectedMeeting({
      id: clickInfo.event.id,
      title: clickInfo.event.title,
      start: clickInfo.event.startStr,
      end: clickInfo.event.endStr,
      organizer_id: clickInfo.event.extendedProps.organizer_id
    });
    setIsDetailsModalOpen(true);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Мій розклад {currentUser && `(${currentUser.email})`}</h1>
        <div>
          <button 
            onClick={() => setIsScheduleModalOpen(true)} 
            style={{ padding: '10px 20px', marginRight: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
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
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
          slotMinTime="08:00:00"
          slotMaxTime="20:00:00"
          allDaySlot={false}
          events={events}
          height="auto"
          eventClick={handleEventClick}
          eventCursor="pointer"
        />
      </div>

      {/* ЗМІНЕНО: Передаємо currentUserId як prop */}
      <ScheduleModal 
        isOpen={isScheduleModalOpen} 
        onClose={() => setIsScheduleModalOpen(false)} 
        onSuccess={() => fetchMeetings(currentUser.id)} 
        currentUserId={currentUser?.id} 
      />

      {/* ЗМІНЕНО: Передаємо currentUserId як prop */}
      <MeetingDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        meeting={selectedMeeting}
        currentUserId={currentUser?.id}
        onSuccess={() => fetchMeetings(currentUser.id)}
      />
    </div>
  );
};

export default Dashboard;
