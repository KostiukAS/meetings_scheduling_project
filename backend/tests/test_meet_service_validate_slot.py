from dataclasses import dataclass
from datetime import datetime, time, timedelta
from unittest.mock import MagicMock

from app.schemas.meeting import ParticipantItem, ValidateSlotRequest
from app.services import meet_service


class QueryMock:
    def __init__(self, items):
        self._items = items

    def filter(self, *args, **kwargs):
        return self

    def join(self, *args, **kwargs):
        return self

    def all(self):
        return self._items


@dataclass
class UserStub:
    id: int
    full_name: str
    email: str


@dataclass
class ResourceStub:
    id: int
    name: str


@dataclass
class ScheduleStub:
    user_id: int
    day_of_week: int
    start_time: time
    end_time: time
    is_day_off: bool


@dataclass
class MeetingParticipantStub:
    user_id: int
    status: str
    weight: int = meet_service.W_OPT

    @property
    def id(self):
        return self.user_id


@dataclass
class MeetingResourceStub:
    resource_id: int
    weight: int = meet_service.W_OPT


@dataclass
class MeetingStub:
    id: int
    title: str
    start_time: datetime
    end_time: datetime
    participants: list
    resources: list
    frequency: str | None = None
    period_stop_time: datetime | None = None


def test_validate_meeting_slot_detects_meeting_and_resource_conflicts():
    start = datetime(2024, 1, 15, 10, 0)
    end = datetime(2024, 1, 15, 11, 0)

    request = ValidateSlotRequest(
        start_time=start,
        end_time=end,
        users=[ParticipantItem(id=1, weight=meet_service.W_MAND)],
        resources=[ParticipantItem(id=2, weight=meet_service.W_OPT)],
    )

    users = [UserStub(id=1, full_name="Test User", email="user@example.com")]
    resources = [ResourceStub(id=2, name="Room A")]
    schedules = [
        ScheduleStub(
            user_id=1,
            day_of_week=start.weekday(),
            start_time=time(0, 0),
            end_time=time(23, 59),
            is_day_off=False,
        )
    ]

    start_utc = meet_service.request_dt_to_utc(start)
    end_utc = meet_service.request_dt_to_utc(end)
    meeting = MeetingStub(
        id=100,
        title="Overlap",
        start_time=start_utc + timedelta(minutes=15),
        end_time=end_utc + timedelta(minutes=15),
        participants=[MeetingParticipantStub(user_id=1, status="Accepted")],
        resources=[MeetingResourceStub(resource_id=2)],
    )

    db = MagicMock()
    db.query.side_effect = [
        QueryMock(users),
        QueryMock(resources),
        QueryMock(schedules),
        QueryMock([meeting]),
        QueryMock([meeting]),
    ]

    result = meet_service.validate_meeting_slot(db, request)

    assert result.is_valid is False
    assert result.score == 3 * (meet_service.W_MAND + meet_service.W_OPT)
    assert len(result.conflicts) == 2


def test_validate_meeting_slot_detects_recurring_conflicts():
    start = datetime(2024, 1, 2, 10, 0)
    end = datetime(2024, 1, 2, 11, 0)

    request = ValidateSlotRequest(
        start_time=start,
        end_time=end,
        users=[ParticipantItem(id=1, weight=meet_service.W_MAND)],
        resources=[],
    )

    users = [UserStub(id=1, full_name="Test User", email="user@example.com")]
    resources = []
    schedules = [
        ScheduleStub(
            user_id=1,
            day_of_week=start.weekday(),
            start_time=time(0, 0),
            end_time=time(23, 59),
            is_day_off=False,
        )
    ]

    meeting_start = datetime(2024, 1, 1, 10, 0)
    meeting_end = datetime(2024, 1, 1, 11, 0)
    meeting = MeetingStub(
        id=101,
        title="Daily Standup",
        start_time=meet_service.request_dt_to_utc(meeting_start),
        end_time=meet_service.request_dt_to_utc(meeting_end),
        participants=[MeetingParticipantStub(user_id=1, status="Accepted")],
        resources=[],
        frequency="daily",
        period_stop_time=None,
    )

    db = MagicMock()
    db.query.side_effect = [
        QueryMock(users),
        QueryMock(resources),
        QueryMock(schedules),
        QueryMock([meeting]),
        QueryMock([]),
    ]

    result = meet_service.validate_meeting_slot(db, request)

    assert result.is_valid is False
    assert any("Daily Standup" in conflict for conflict in result.conflicts)


def test_validate_meeting_slot_optional_existing_conflict_is_not_critical_in_soft_mode():
    start = datetime(2024, 1, 15, 10, 0)
    end = datetime(2024, 1, 15, 11, 0)

    request = ValidateSlotRequest(
        start_time=start,
        end_time=end,
        soft_validation=True,
        users=[ParticipantItem(id=1, weight=meet_service.W_MAND)],
        resources=[],
    )

    users = [UserStub(id=1, full_name="Test User", email="user@example.com")]
    schedules = [
        ScheduleStub(
            user_id=1,
            day_of_week=start.weekday(),
            start_time=time(0, 0),
            end_time=time(23, 59),
            is_day_off=False,
        )
    ]

    start_utc = meet_service.request_dt_to_utc(start)
    end_utc = meet_service.request_dt_to_utc(end)
    meeting = MeetingStub(
        id=102,
        title="Optional overlap",
        start_time=start_utc + timedelta(minutes=15),
        end_time=end_utc + timedelta(minutes=15),
        participants=[MeetingParticipantStub(user_id=1, status="Accepted", weight=meet_service.W_OPT)],
        resources=[],
    )

    db = MagicMock()
    db.query.side_effect = [
        QueryMock(users),
        QueryMock([]),
        QueryMock(schedules),
        QueryMock([meeting]),
        QueryMock([]),
    ]

    result = meet_service.validate_meeting_slot(db, request)

    assert result.is_valid is True
    assert result.score == 3 * meet_service.W_OPT
    assert any("Optional overlap" in conflict for conflict in result.conflicts)


def test_validate_meeting_slot_counts_full_overlap_in_quanta_for_optional_conflict():
    start = datetime(2024, 1, 15, 10, 0)
    end = datetime(2024, 1, 15, 11, 0)

    request = ValidateSlotRequest(
        start_time=start,
        end_time=end,
        soft_validation=True,
        users=[ParticipantItem(id=1, weight=meet_service.W_MAND)],
        resources=[],
    )

    users = [UserStub(id=1, full_name="Test User", email="user@example.com")]
    schedules = [
        ScheduleStub(
            user_id=1,
            day_of_week=start.weekday(),
            start_time=time(0, 0),
            end_time=time(23, 59),
            is_day_off=False,
        )
    ]

    meeting = MeetingStub(
        id=103,
        title="Exact overlap",
        start_time=meet_service.request_dt_to_utc(start),
        end_time=meet_service.request_dt_to_utc(end),
        participants=[MeetingParticipantStub(user_id=1, status="Accepted", weight=meet_service.W_OPT)],
        resources=[],
    )

    db = MagicMock()
    db.query.side_effect = [
        QueryMock(users),
        QueryMock([]),
        QueryMock(schedules),
        QueryMock([meeting]),
        QueryMock([]),
    ]

    result = meet_service.validate_meeting_slot(db, request)

    assert result.is_valid is True
    assert result.score == 4 * meet_service.W_OPT
    assert any("Exact overlap" in conflict for conflict in result.conflicts)
