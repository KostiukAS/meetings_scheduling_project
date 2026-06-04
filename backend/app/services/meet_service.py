from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone, time, date
from zoneinfo import ZoneInfo
from app.schemas.meeting import FindSlotsRequest, SlotResponse, SlotSubResponse, MeetingCreate, ValidateSlotRequest, ValidateSlotResponse, ParticipantItem
from app.models.meeting import Meeting, MeetingParticipant
from app.models.resource import MeetingResource, Resource
from app.models.user import Schedule, User
from app.algorithm.scheduler import find_best_meeting_slots, W_MAND
from app.core.config import settings

QUANT_MINUTES = 15
APP_TZ = ZoneInfo(settings.APP_TIMEZONE)

def request_dt_to_local(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(APP_TZ).replace(tzinfo=None)

def request_dt_to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=APP_TZ)
    else:
        dt = dt.astimezone(APP_TZ)
    return dt.astimezone(timezone.utc).replace(tzinfo=None)

def utc_db_dt_to_local(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(APP_TZ).replace(tzinfo=None)

def utc_time_to_local_datetime(date_value: date, t: time) -> datetime:
    return datetime.combine(date_value, t, tzinfo=timezone.utc).astimezone(APP_TZ).replace(tzinfo=None)

def dt_to_quant(dt: datetime, base_dt: datetime) -> int:
    delta = dt - base_dt
    return int(delta.total_seconds() // (QUANT_MINUTES * 60))

def quant_to_dt(q: int, base_dt: datetime) -> datetime:
    return base_dt + timedelta(minutes=q * QUANT_MINUTES)

def floor_to_quantum(dt: datetime) -> datetime:
    minutes = (dt.minute // QUANT_MINUTES) * QUANT_MINUTES
    return dt.replace(minute=minutes, second=0, microsecond=0)

def ceil_to_quantum(dt: datetime) -> datetime:
    floored = floor_to_quantum(dt)
    if floored < dt:
        return floored + timedelta(minutes=QUANT_MINUTES)
    return floored

def project_recurring_busy(busy_list, start_time, end_time, frequency, search_start, search_end, base_dt, resource_prefix, res_id, stop_time=None):
    meeting_duration = end_time - start_time
    current_occurrence_start = start_time
    
    step = None
    if frequency == "daily":
        step = timedelta(days=1)
    elif frequency == "weekly":
        step = timedelta(weeks=1)
    
    if not step:
        return

    if stop_time and stop_time <= start_time:
        return

    effective_end = search_end
    if stop_time:
        if stop_time <= search_start:
            return
        effective_end = min(search_end, stop_time)

    while current_occurrence_start < effective_end:
        current_occurrence_end = current_occurrence_start + meeting_duration
        
        if current_occurrence_end > search_start:
            busy_list.append({
                "resource_id": f"{resource_prefix}_{res_id}",
                "start_quantum": max(0, dt_to_quant(current_occurrence_start, base_dt)),
                "end_quantum": dt_to_quant(current_occurrence_end, base_dt)
            })
        
        current_occurrence_start += step

def find_available_slots(db: Session, request: FindSlotsRequest):
    search_start = request_dt_to_local(request.search_start)
    search_end = request_dt_to_local(request.search_end)
    search_start_utc = request_dt_to_utc(request.search_start)
    search_end_utc = request_dt_to_utc(request.search_end)

    base_dt = floor_to_quantum(search_start)
    aligned_start = ceil_to_quantum(search_start)

    d_quant = request.duration_minutes // QUANT_MINUTES
    t_start = dt_to_quant(aligned_start, base_dt)
    t_end = dt_to_quant(search_end, base_dt)
    
    r_m = []
    busy = []
    
    for u in request.users:
        r_m.append({"id": f"u_{u.id}", "weight": u.weight})
    for r in request.resources:
        r_m.append({"id": f"r_{r.id}", "weight": r.weight})
        
    user_ids = [u.id for u in request.users]
    resource_ids = [r.id for r in request.resources]

    if user_ids:
        schedules = db.query(Schedule).filter(Schedule.user_id.in_(user_ids)).all()
        sched_map = {}
        for s in schedules:
            if s.user_id not in sched_map:
                sched_map[s.user_id] = {}
            sched_map[s.user_id][s.day_of_week] = s

        current_date = search_start.date()
        end_date = search_end.date()
        
        while current_date <= end_date:
            day_of_week = current_date.weekday()
            day_start = datetime.combine(current_date, datetime.min.time())
            day_end = datetime.combine(current_date, datetime.max.time())
            
            for u_id in user_ids:
                s = sched_map.get(u_id, {}).get(day_of_week)
                
                if not s or s.is_day_off:
                    busy.append({
                        "resource_id": f"u_{u_id}",
                        "start_quantum": max(0, dt_to_quant(day_start, base_dt)),
                        "end_quantum": dt_to_quant(day_end, base_dt)
                    })
                else:
                    work_start = utc_time_to_local_datetime(current_date, s.start_time)
                    if work_start > day_start:
                        busy.append({
                            "resource_id": f"u_{u_id}",
                            "start_quantum": max(0, dt_to_quant(day_start, base_dt)),
                            "end_quantum": dt_to_quant(work_start, base_dt)
                        })
                        
                    work_end = utc_time_to_local_datetime(current_date, s.end_time)
                    if work_end < day_end:
                        busy.append({
                            "resource_id": f"u_{u_id}",
                            "start_quantum": max(0, dt_to_quant(work_end, base_dt)),
                            "end_quantum": dt_to_quant(day_end, base_dt)
                        })
            
            current_date += timedelta(days=1)

    if user_ids:
        user_meetings = db.query(Meeting).join(MeetingParticipant).filter(
            MeetingParticipant.user_id.in_(user_ids),
            Meeting.start_time < search_end_utc
        ).all()
        
        for m in user_meetings:
            m_start_local = utc_db_dt_to_local(m.start_time)
            m_end_local = utc_db_dt_to_local(m.end_time)
            for mp in m.participants:
                if mp.user_id in user_ids and mp.status != "Rejected":
                    if m.frequency == "once" or not m.frequency:
                        if m_end_local > search_start:
                            busy.append({
                                "resource_id": f"u_{mp.user_id}",
                                "start_quantum": max(0, dt_to_quant(m_start_local, base_dt)),
                                "end_quantum": dt_to_quant(m_end_local, base_dt)
                            })
                    else:
                        stop_time_local = utc_db_dt_to_local(m.period_stop_time) if m.period_stop_time else None
                        project_recurring_busy(
                            busy,
                            m_start_local,
                            m_end_local,
                            m.frequency,
                            search_start,
                            search_end,
                            base_dt,
                            "u",
                            mp.user_id,
                            stop_time_local
                        )

    if resource_ids:
        res_meetings = db.query(Meeting).join(MeetingResource).filter(
            MeetingResource.resource_id.in_(resource_ids), 
            Meeting.start_time < search_end_utc
        ).all()
        
        for m in res_meetings:
            m_start_local = utc_db_dt_to_local(m.start_time)
            m_end_local = utc_db_dt_to_local(m.end_time)
            for mr in m.resources: 
                if mr.resource_id in resource_ids:
                    if m.frequency == "once" or not m.frequency:
                        if m_end_local > search_start:
                            busy.append({
                                "resource_id": f"r_{mr.resource_id}",
                                "start_quantum": max(0, dt_to_quant(m_start_local, base_dt)),
                                "end_quantum": dt_to_quant(m_end_local, base_dt)
                            })
                    else:
                        stop_time_local = utc_db_dt_to_local(m.period_stop_time) if m.period_stop_time else None
                        project_recurring_busy(
                            busy,
                            m_start_local,
                            m_end_local,
                            m.frequency,
                            search_start,
                            search_end,
                            base_dt,
                            "r",
                            mr.resource_id,
                            stop_time_local
                        )
        
    best_quanta_slots = find_best_meeting_slots(
        d=d_quant,
        t_start=0,
        t_end=t_end,
        r_m=r_m,
        busy=busy
    )
    
    def build_slot_payload(slot_dict):
        start_dt = quant_to_dt(slot_dict["start_time"], base_dt)
        end_dt = quant_to_dt(slot_dict["end_time"] + 1, base_dt)

        return {
            "start_time": request_dt_to_utc(start_dt),
            "end_time": request_dt_to_utc(end_dt),
            "score": slot_dict["score"]
        }

    result = []
    for slot in best_quanta_slots:
        slot_payload = build_slot_payload(slot)
        subslots_payload = [build_slot_payload(sub) for sub in slot.get("subslots", [])]

        result.append(SlotResponse(
            **slot_payload,
            subslots=[SlotSubResponse(**sub) for sub in subslots_payload]
        ))

    return result

def create_meeting(db: Session, meeting_data: MeetingCreate, current_user_id: int):
    """
    Зберігає нову зустріч у базу даних разом із її учасниками та ресурсами.
    """
    # 1. Створюємо основний запис зустрічі
    new_meeting = Meeting(
        title=meeting_data.title,
        description=meeting_data.description,
        start_time=request_dt_to_utc(meeting_data.start_time),
        end_time=request_dt_to_utc(meeting_data.end_time),
        frequency=meeting_data.frequency,
        project_id=meeting_data.project_id,
        organizer_id=current_user_id
    )
    db.add(new_meeting)
    db.commit()
    db.refresh(new_meeting)

    # 2. Додаємо учасників у зв'язну таблицю
    participants_by_id = {}
    for p in meeting_data.participants:
        if p.id not in participants_by_id:
            participants_by_id[p.id] = p

    if current_user_id not in participants_by_id:
        participants_by_id[current_user_id] = ParticipantItem(
            id=current_user_id,
            weight=1_000_000
        )

    for p in participants_by_id.values():
        status = "Accepted" if p.id == current_user_id else "Waiting for response"
        mp = MeetingParticipant(
            meeting_id=new_meeting.id,
            user_id=p.id,
            weight=p.weight,
            status=status
        )
        db.add(mp)

    # 3. Додаємо ресурси у зв'язну таблицю
    for r in meeting_data.resources:
        mr = MeetingResource(
            meeting_id=new_meeting.id, 
            resource_id=r.id, 
            weight=r.weight
        )
        db.add(mr)

    db.commit()
    db.refresh(new_meeting)
    
    return new_meeting

def get_user_meetings(db: Session, user_id: int):
    """Отримує всі зустрічі, в яких бере участь користувач."""
    return db.query(Meeting).join(MeetingParticipant).filter(
        MeetingParticipant.user_id == user_id
    ).all()

def validate_meeting_slot(db: Session, request: ValidateSlotRequest) -> ValidateSlotResponse:
    """Валідація з виводом імен та назв."""
    start_dt = request_dt_to_local(request.start_time)
    end_dt = request_dt_to_local(request.end_time)
    start_dt_utc = request_dt_to_utc(request.start_time)
    end_dt_utc = request_dt_to_utc(request.end_time)

    user_ids = [u.id for u in request.users]
    resource_ids = [r.id for r in request.resources]

    users_db = db.query(User).filter(User.id.in_(user_ids)).all()
    user_names = {u.id: u.full_name or u.email for u in users_db}
    
    resources_db = db.query(Resource).filter(Resource.id.in_(resource_ids)).all()
    res_names = {r.id: r.name for r in resources_db}

    conflicts = []
    score = 0
    has_critical_conflict = False

    # 1. Графіки
    schedules = db.query(Schedule).filter(Schedule.user_id.in_(user_ids)).all()
    sched_map = {s.user_id: {} for s in schedules}
    for s in schedules:
        sched_map[s.user_id][s.day_of_week] = s

    current_date = start_dt.date()
    while current_date <= end_dt.date():
        day_of_week = current_date.weekday()
        for u in request.users:
            name = user_names.get(u.id, f"ID {u.id}")
            s = sched_map.get(u.id, {}).get(day_of_week)
            if not s or s.is_day_off:
                conflicts.append(f"У {name} вихідний")
                score += u.weight
                if u.weight >= W_MAND:
                    has_critical_conflict = True
            else:
                work_start = utc_time_to_local_datetime(current_date, s.start_time)
                work_end = utc_time_to_local_datetime(current_date, s.end_time)
                if start_dt < work_start or end_dt > work_end:
                    conflicts.append(f"Час поза межами робочого дня {name}")
                    score += u.weight
                    if u.weight >= W_MAND:
                        has_critical_conflict = True
        current_date += timedelta(days=1)

    # 2. Зустрічі Користувачів
    user_meetings = db.query(Meeting).join(MeetingParticipant).filter(
        MeetingParticipant.user_id.in_(user_ids),
        Meeting.start_time < end_dt_utc,
        Meeting.end_time > start_dt_utc
    ).all()

    if request.meeting_id:
        user_meetings = [m for m in user_meetings if m.id != request.meeting_id]

    for m in user_meetings:
        for mp in m.participants:
            if mp.user_id in user_ids and mp.status != "Rejected":
                name = user_names.get(mp.id, f"ID {mp.user_id}")
                conflicts.append(f"{name} вже має зустріч: '{m.title}'")
                weight = next((u.weight for u in request.users if u.id == mp.user_id), 10)
                score += weight
                if weight >= W_MAND:
                    has_critical_conflict = True

    # 3. Ресурси (Кімнати)
    res_meetings = db.query(Meeting).join(MeetingResource).filter(
        MeetingResource.resource_id.in_(resource_ids),
        Meeting.start_time < end_dt_utc,
        Meeting.end_time > start_dt_utc
    ).all()

    if request.meeting_id:
        res_meetings = [m for m in res_meetings if m.id != request.meeting_id]

    for m in res_meetings:
        for mr in m.resources:
            if mr.resource_id in resource_ids:
                name = res_names.get(mr.resource_id, f"Кімната {mr.resource_id}")
                conflicts.append(f"Кімната '{name}' зайнята: '{m.title}'")
                weight = next((r.weight for r in request.resources if r.id == mr.resource_id), 10)
                score += weight
                if weight >= W_MAND:
                    has_critical_conflict = True

    return ValidateSlotResponse(
        is_valid=(not has_critical_conflict) if request.soft_validation else len(list(set(conflicts))) == 0,
        score=score,
        conflicts=list(set(conflicts))
    )
