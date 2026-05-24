import React, { useState, useEffect } from 'react';
import ukLocale from '@fullcalendar/core/locales/uk';
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
      const formattedEvents = [];

      response.data.forEach(meeting => {
        const startUTC = meeting.start_time.endsWith('Z') ? meeting.start_time : `${meeting.start_time}Z`;
        const endUTC = meeting.end_time.endsWith('Z') ? meeting.end_time : `${meeting.end_time}Z`;
        
        const baseEvent = {
          id: meeting.id,
          title: meeting.title,
          backgroundColor: meeting.organizer_id === userId ? '#28a745' : '#3788d8',
          extendedProps: {
            organizer_id: meeting.organizer_id,
            frequency: meeting.frequency,
            description: meeting.description,
            participants: meeting.participants,
            resources: meeting.resources
          }
        };

        if (meeting.frequency === 'once' || !meeting.frequency) {
          formattedEvents.push({
            ...baseEvent,
            start: startUTC,
            end: endUTC
          });
        } else if (meeting.frequency === 'daily') {
          formattedEvents.push({
            ...baseEvent,
            startTime: new Date(startUTC).toLocaleTimeString('en-GB', { hour12: false }),
            endTime: new Date(endUTC).toLocaleTimeString('en-GB', { hour12: false }),
            startRecur: startUTC, // Починати відображати з дати створення
            daysOfWeek: [1, 2, 3, 4, 5]
          });
        } else if (meeting.frequency === 'weekly') {
          const dayNum = new Date(startUTC).getDay(); // Отримуємо день тижня (0-6)
          formattedEvents.push({
            ...baseEvent,
            startTime: new Date(startUTC).toLocaleTimeString('en-GB', { hour12: false }),
            endTime: new Date(endUTC).toLocaleTimeString('en-GB', { hour12: false }),
            startRecur: startUTC,
            daysOfWeek: [dayNum]
          });
        }
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
      organizer_id: clickInfo.event.extendedProps.organizer_id,
      frequency: clickInfo.event.extendedProps.frequency,
      description: clickInfo.event.extendedProps.description,
      participants: clickInfo.event.extendedProps.participants,
      resources: clickInfo.event.extendedProps.resources
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
          locale={ukLocale}
          firstDay={1}
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
