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
import { hasAllPermission } from '../utils/permissions';

const Dashboard = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);

  // ДОДАНО: Стан для зберігання поточного користувача
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    document.title = 'Home | Meetings Scheduler';
  }, []);

  // ДОДАНО: Функція для отримання профілю користувача
  const fetchCurrentUser = async () => {
    try {
      const response = await api.get('/users/me');
      setCurrentUser(response.data);
    } catch (error) {
      if (error.response?.status === 401) handleLogout();
    }
  };

  const fetchRolePermissions = async (roleId) => {
    if (!roleId) {
      setIsAdmin(false);
      return;
    }

    try {
      const response = await api.get('/roles/');
      const role = response.data.find((item) => Number(item.id) === Number(roleId));
      setIsAdmin(hasAllPermission(role?.permissions));
    } catch (error) {
      if (error.response?.status === 401) handleLogout();
      setIsAdmin(false);
    }
  };

  const fetchMeetings = async (userId) => {
      try {
      const response = await api.get('/meetings/');
      const formattedEvents = [];

      const formatLocalDate = (value) => {
        const date = new Date(value);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      response.data.forEach(meeting => {
        const startLocal = meeting.start_time;
        const endLocal = meeting.end_time;
        const endRecur = meeting.period_stop_time
          ? formatLocalDate(meeting.period_stop_time)
          : undefined;
        
        const baseEvent = {
          id: meeting.id,
          title: meeting.title,
          backgroundColor: meeting.organizer_id === userId ? '#28a745' : '#3788d8',
          extendedProps: {
            organizer_id: meeting.organizer_id,
            frequency: meeting.frequency,
            description: meeting.description,
            participants: meeting.participants,
            resources: meeting.resources,
            project_id: meeting.project_id,
            period_stop_time: meeting.period_stop_time
          }
        };

        if (meeting.frequency === 'once' || !meeting.frequency) {
          formattedEvents.push({
            ...baseEvent,
            start: startLocal,
            end: endLocal
          });
        } else if (meeting.frequency === 'daily') {
          formattedEvents.push({
            ...baseEvent,
            startTime: new Date(startLocal).toLocaleTimeString('en-GB', { hour12: false }),
            endTime: new Date(endLocal).toLocaleTimeString('en-GB', { hour12: false }),
            startRecur: startLocal, // Починати відображати з дати створення
            endRecur,
            daysOfWeek: [1, 2, 3, 4, 5]
          });
        } else if (meeting.frequency === 'weekly') {
          const dayNum = new Date(startLocal).getDay(); // Отримуємо день тижня (0-6)
          formattedEvents.push({
            ...baseEvent,
            startTime: new Date(startLocal).toLocaleTimeString('en-GB', { hour12: false }),
            endTime: new Date(endLocal).toLocaleTimeString('en-GB', { hour12: false }),
            startRecur: startLocal,
            endRecur,
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

  useEffect(() => {
    if (currentUser) {
      fetchRolePermissions(currentUser.role_id);
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
      resources: clickInfo.event.extendedProps.resources,
      project_id: clickInfo.event.extendedProps.project_id,
      period_stop_time: clickInfo.event.extendedProps.period_stop_time
    });
    setIsDetailsModalOpen(true);
  };

  const nameText = currentUser?.full_name?.trim() || currentUser?.email || '';
  const emailText = currentUser?.full_name?.trim() ? currentUser?.email || '' : '';

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">Панель користувача</p>
          {(nameText || emailText) && (
            <div className="dashboard-identity">
              {nameText && <p className="dashboard-identity-name">{nameText}</p>}
              {emailText && <p className="dashboard-identity-email">{emailText}</p>}
            </div>
          )}
          <h1 className="dashboard-title">Мій розклад</h1>
        </div>
        <div className="dashboard-actions">
          {isAdmin && (
            <button onClick={() => navigate('/admin')} className="btn btn-warning">
              Панель адміністратора
            </button>
          )}
          <button
            onClick={() => setIsScheduleModalOpen(true)}
            className="btn btn-primary"
          >
            + Запланувати зустріч
          </button>
          <button onClick={handleLogout} className="btn btn-danger">
            Вийти
          </button>
        </div>
      </header>

      <div className="card calendar-card">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
          slotMinTime="08:00:00"
          slotMaxTime="20:00:00"
          slotDuration="00:15:00"
          slotLabelInterval="00:30:00"
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
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
