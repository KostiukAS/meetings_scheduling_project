from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.schemas.meeting import FindSlotsRequest, SlotResponse, MeetingCreate
from app.models.meeting import Meeting, MeetingParticipant
from app.models.resource import MeetingResource
from app.models.user import Schedule
from app.algorithm.scheduler import find_best_meeting_slots

QUANT_MINUTES = 15

def dt_to_quant(dt: datetime, base_dt: datetime) -> int:
    delta = dt - base_dt
    return int(delta.total_seconds() // (QUANT_MINUTES * 60))

def quant_to_dt(q: int, base_dt: datetime) -> datetime:
    return base_dt + timedelta(minutes=q * QUANT_MINUTES)

def find_available_slots(db: Session, request: FindSlotsRequest):
    search_start = request.search_start.replace(tzinfo=None)
    search_end = request.search_end.replace(tzinfo=None)
    
    base_dt = search_start 
    
    d_quant = request.duration_minutes // QUANT_MINUTES
    t_start = 0
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
                    work_start = datetime.combine(current_date, s.start_time)
                    if work_start > day_start:
                        busy.append({
                            "resource_id": f"u_{u_id}",
                            "start_quantum": max(0, dt_to_quant(day_start, base_dt)),
                            "end_quantum": dt_to_quant(work_start, base_dt)
                        })
                        
                    work_end = datetime.combine(current_date, s.end_time)
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
            Meeting.end_time > request.search_start,
            Meeting.start_time < request.search_end
        ).all()
        
        for m in user_meetings:
            start_q = dt_to_quant(m.start_time, base_dt)
            end_q = dt_to_quant(m.end_time, base_dt)
            for mp in m.participants: 
                if mp.user_id in user_ids and mp.status != "Rejected":
                    busy.append({
                        "resource_id": f"u_{mp.user_id}",
                        "start_quantum": max(0, start_q),
                        "end_quantum": end_q
                    })

    if resource_ids:
        res_meetings = db.query(Meeting).join(MeetingResource).filter(
            MeetingResource.resource_id.in_(resource_ids),
            Meeting.end_time > request.search_start,
            Meeting.start_time < request.search_end
        ).all()
        
        for m in res_meetings:
            start_q = dt_to_quant(m.start_time, base_dt)
            end_q = dt_to_quant(m.end_time, base_dt)
            for mr in m.resources: 
                if mr.resource_id in resource_ids:
                    busy.append({
                        "resource_id": f"r_{mr.resource_id}",
                        "start_quantum": max(0, start_q),
                        "end_quantum": end_q
                    })
        
    best_quanta_slots = find_best_meeting_slots(
        d=d_quant,
        t_start=t_start,
        t_end=t_end,
        r_m=r_m,
        busy=busy
    )
    
    result = []
    for slot in best_quanta_slots:
        start_dt = quant_to_dt(slot["start_time"], base_dt)
        end_dt = quant_to_dt(slot["end_time"] + 1, base_dt) 
        
        result.append(SlotResponse(
            start_time=start_dt,
            end_time=end_dt,
            score=slot["score"]
        ))
        
    return result

def create_meeting(db: Session, meeting_data: MeetingCreate, current_user_id: int):
    """
    Зберігає нову зустріч у базу даних разом із її учасниками та ресурсами.
    """
    # 1. Створюємо основний запис зустрічі
    new_meeting = Meeting(
        title=meeting_data.title,
        start_time=meeting_data.start_time,
        end_time=meeting_data.end_time,
        project_id=meeting_data.project_id,
        organizer_id=current_user_id
    )
    db.add(new_meeting)
    db.commit()
    db.refresh(new_meeting)

    # 2. Додаємо учасників у зв'язну таблицю
    for p in meeting_data.participants:
        mp = MeetingParticipant(
            meeting_id=new_meeting.id, 
            user_id=p.id, 
            weight=p.weight, 
            status="Waiting for response"
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
