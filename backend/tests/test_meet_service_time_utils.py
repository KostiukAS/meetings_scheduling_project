from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

from app.services import meet_service


def test_floor_and_ceil_to_quantum():
    dt = datetime(2024, 1, 15, 10, 7, 30)

    assert meet_service.floor_to_quantum(dt) == datetime(2024, 1, 15, 10, 0)
    assert meet_service.ceil_to_quantum(dt) == datetime(2024, 1, 15, 10, 15)
    assert meet_service.ceil_to_quantum(datetime(2024, 1, 15, 10, 15)) == datetime(2024, 1, 15, 10, 15)


def test_quant_round_trip():
    base = datetime(2024, 1, 15, 9, 0)
    target = datetime(2024, 1, 15, 10, 30)

    q = meet_service.dt_to_quant(target, base)

    assert q == 6
    assert meet_service.quant_to_dt(q, base) == target


def test_request_dt_to_local_and_utc():
    local_naive = datetime(2024, 1, 15, 12, 0)

    assert meet_service.request_dt_to_local(local_naive) == local_naive

    tz = ZoneInfo(meet_service.settings.APP_TIMEZONE)
    expected_utc = local_naive.replace(tzinfo=tz).astimezone(timezone.utc).replace(tzinfo=None)

    assert meet_service.request_dt_to_utc(local_naive) == expected_utc


def test_utc_db_dt_to_local_and_utc_time_to_local_datetime():
    dt_utc_naive = datetime(2024, 1, 15, 12, 0)
    tz = ZoneInfo(meet_service.settings.APP_TIMEZONE)

    expected_local = dt_utc_naive.replace(tzinfo=timezone.utc).astimezone(tz).replace(tzinfo=None)
    assert meet_service.utc_db_dt_to_local(dt_utc_naive) == expected_local

    expected_time_local = datetime.combine(date(2024, 1, 15), time(12, 0), tzinfo=timezone.utc)
    expected_time_local = expected_time_local.astimezone(tz).replace(tzinfo=None)

    assert meet_service.utc_time_to_local_datetime(date(2024, 1, 15), time(12, 0)) == expected_time_local
