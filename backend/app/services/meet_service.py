from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.schemas.meeting import FindSlotsRequest, SlotResponse
from app.models.meeting import Meeting, MeetingParticipant
from app.models.resource import MeetingResource
from app.algorithm.scheduler import find_best_meeting_slots

QUANT_MINUTES = 15

def dt_to_quant(dt: datetime, base_dt: datetime) -> int:
    """Перетворює реальний час у номер кванта відносно base_dt."""
    delta = dt - base_dt
    return int(delta.total_seconds() // (QUANT_MINUTES * 60))

def quant_to_dt(q: int, base_dt: datetime) -> datetime:
    """Перетворює номер кванта назад у реальний час."""
    return base_dt + timedelta(minutes=q * QUANT_MINUTES)

def find_available_slots(db: Session, request: FindSlotsRequest):
    base_dt = request.search_start # Точка відліку (квант 0)
    
    # 1. Підготовка вхідних даних для алгоритму
    d_quant = request.duration_minutes // QUANT_MINUTES
    t_start = 0
    t_end = dt_to_quant(request.search_end, base_dt)
    
    r_m = []
    busy = []
    
    for u in request.users:
        r_m.append({"id": f"u_{u.id}", "weight": u.weight})
    for r in request.resources:
        r_m.append({"id": f"r_{r.id}", "weight": r.weight})
        
    user_ids = [u.id for u in request.users]
    resource_ids = [r.id for r in request.resources]

    # 2. Витягуємо з БД існуючі зайнятості КОРИСТУВАЧІВ у цьому діапазоні
    if user_ids:
        user_meetings = db.query(Meeting).join(MeetingParticipant).filter(
            MeetingParticipant.user_id.in_(user_ids),
            Meeting.end_time > request.search_start,
            Meeting.start_time < request.search_end
        ).all()
        
        # Заповнюємо масив busy для алгоритму (користувачі)
        for m in user_meetings:
            start_q = dt_to_quant(m.start_time, base_dt)
            end_q = dt_to_quant(m.end_time, base_dt)
            for mp in m.participants: 
                if mp.user_id in user_ids:
                    busy.append({
                        "resource_id": f"u_{mp.user_id}",
                        "start_quantum": max(0, start_q),
                        "end_quantum": end_q
                    })

    # 3. Витягуємо з БД зайнятості РЕСУРСІВ (кімнат/обладнання)
    if resource_ids:
        res_meetings = db.query(Meeting).join(MeetingResource).filter(
            MeetingResource.resource_id.in_(resource_ids),
            Meeting.end_time > request.search_start,
            Meeting.start_time < request.search_end
        ).all()
        
        # Заповнюємо масив busy для алгоритму (ресурси)
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
        
    # 4. Запуск алгоритму планування
    best_quanta_slots = find_best_meeting_slots(
        d=d_quant,
        t_start=t_start,
        t_end=t_end,
        r_m=r_m,
        busy=busy
    )
    
    # 5. Конвертуємо кванти назад у дати
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
