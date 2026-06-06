from datetime import time

import pytest

from app.models.user import Role, User
from app.schemas.schedule import ScheduleCreate
from app.services import schedule_service


@pytest.mark.integration
def test_schedule_service_crud(db_session):
    role = Role(name="Member", permissions="*")
    db_session.add(role)
    db_session.commit()
    db_session.refresh(role)

    user = User(
        full_name="Schedule User",
        email="schedule.user@example.com",
        password_hash="hashed",
        role_id=role.id,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    schedule = ScheduleCreate(
        day_of_week=0,
        start_time=time(9, 0),
        end_time=time(17, 0),
        is_day_off=False,
    )

    created = schedule_service.create_user_schedule(db_session, user.id, schedule)
    fetched = schedule_service.get_user_schedules(db_session, user.id)

    assert created.id is not None
    assert len(fetched) == 1
    assert fetched[0].day_of_week == schedule.day_of_week
    assert fetched[0].start_time == schedule.start_time
    assert fetched[0].end_time == schedule.end_time

    deleted = schedule_service.delete_schedule(db_session, created.id)
    remaining = schedule_service.get_user_schedules(db_session, user.id)

    assert deleted is not None
    assert remaining == []
