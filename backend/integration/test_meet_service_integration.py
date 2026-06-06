from datetime import datetime, time, timedelta

import pytest

from app.models.resource import Resource
from app.models.user import Role, Schedule, User
from app.schemas.meeting import FindSlotsRequest, MeetingCreate, ParticipantItem, ValidateSlotRequest
from app.services import meet_service


def _create_role_and_user(db_session, email):
    role = Role(name=f"Role-{email}", permissions="*")
    db_session.add(role)
    db_session.commit()
    db_session.refresh(role)

    user = User(
        full_name="Integration User",
        email=email,
        password_hash="hashed",
        role_id=role.id,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    return user


@pytest.mark.integration
def test_create_meeting_persists_participants_and_resources(db_session):
    organizer = _create_role_and_user(db_session, "organizer@example.com")
    participant = _create_role_and_user(db_session, "participant@example.com")

    resource = Resource(name="Room A", type="room", capacity=5)
    db_session.add(resource)
    db_session.commit()
    db_session.refresh(resource)

    start_time = datetime(2024, 1, 15, 10, 0)
    end_time = datetime(2024, 1, 15, 11, 0)

    meeting_data = MeetingCreate(
        title="Integration Meeting",
        description="Test",
        start_time=start_time,
        end_time=end_time,
        frequency="once",
        participants=[ParticipantItem(id=participant.id, weight=meet_service.W_OPT)],
        resources=[ParticipantItem(id=resource.id, weight=5)],
    )

    meeting = meet_service.create_meeting(db_session, meeting_data, organizer.id)
    db_session.refresh(meeting)

    assert meeting.id is not None
    assert len(meeting.participants) == 2
    assert any(p.user_id == organizer.id for p in meeting.participants)
    assert any(p.user_id == participant.id for p in meeting.participants)
    assert len(meeting.resources) == 1
    assert meeting.resources[0].resource_id == resource.id


@pytest.mark.integration
def test_validate_meeting_slot_detects_conflicts(db_session):
    user = _create_role_and_user(db_session, "conflict.user@example.com")

    resource = Resource(name="Room B", type="room", capacity=10)
    db_session.add(resource)
    db_session.commit()
    db_session.refresh(resource)

    schedule = Schedule(
        user_id=user.id,
        day_of_week=0,
        start_time=time(0, 0),
        end_time=time(23, 59),
        is_day_off=False,
    )
    db_session.add(schedule)
    db_session.commit()

    meeting_start = datetime(2024, 1, 15, 10, 0)
    meeting_end = datetime(2024, 1, 15, 11, 0)

    meeting_data = MeetingCreate(
        title="Busy",
        start_time=meeting_start,
        end_time=meeting_end,
        frequency="once",
        participants=[ParticipantItem(id=user.id, weight=meet_service.W_MAND)],
        resources=[ParticipantItem(id=resource.id, weight=meet_service.W_OPT)],
    )

    meet_service.create_meeting(db_session, meeting_data, user.id)

    request = ValidateSlotRequest(
        start_time=meeting_start + timedelta(minutes=15),
        end_time=meeting_end + timedelta(minutes=15),
        users=[ParticipantItem(id=user.id, weight=meet_service.W_MAND)],
        resources=[ParticipantItem(id=resource.id, weight=meet_service.W_OPT)],
    )

    result = meet_service.validate_meeting_slot(db_session, request)

    assert result.is_valid is False
    assert len(result.conflicts) == 2
    assert result.score == meet_service.W_MAND + meet_service.W_OPT


@pytest.mark.integration
def test_find_available_slots_keeps_optional_existing_participant_as_penalty(db_session):
    organizer = _create_role_and_user(db_session, "findslots.organizer@example.com")
    participant = _create_role_and_user(db_session, "findslots.participant@example.com")

    schedule = Schedule(
        user_id=participant.id,
        day_of_week=0,
        start_time=time(9, 0),
        end_time=time(18, 0),
        is_day_off=False,
    )
    db_session.add(schedule)
    db_session.commit()

    meeting_start = datetime(2024, 1, 15, 10, 0)
    meeting_end = datetime(2024, 1, 15, 11, 0)

    existing_meeting = MeetingCreate(
        title="Optional Busy",
        start_time=meeting_start,
        end_time=meeting_end,
        frequency="once",
        participants=[ParticipantItem(id=participant.id, weight=meet_service.W_OPT)],
        resources=[],
    )
    meet_service.create_meeting(db_session, existing_meeting, organizer.id)

    request = FindSlotsRequest(
        duration_minutes=60,
        search_start=meeting_start,
        search_end=meeting_end,
        users=[ParticipantItem(id=participant.id, weight=meet_service.W_MAND)],
        resources=[],
    )

    result = meet_service.find_available_slots(db_session, request)

    assert len(result) == 1
    assert result[0].score == 4 * meet_service.W_OPT
