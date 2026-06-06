from datetime import datetime, timedelta

from app.services import meet_service


def test_project_recurring_busy_daily_in_range():
    base_dt = datetime(2024, 1, 1, 0, 0)
    start_time = base_dt + timedelta(hours=9)
    end_time = start_time + timedelta(hours=1)
    search_start = base_dt
    search_end = base_dt + timedelta(days=4)

    busy = []
    meet_service.project_recurring_busy(
        busy,
        start_time,
        end_time,
        frequency="daily",
        search_start=search_start,
        search_end=search_end,
        base_dt=base_dt,
        resource_prefix="u",
        res_id=5,
    )

    assert len(busy) == 4

    expected_starts = [
        meet_service.dt_to_quant(start_time + timedelta(days=offset), base_dt)
        for offset in range(4)
    ]
    expected_ends = [
        meet_service.dt_to_quant(end_time + timedelta(days=offset), base_dt)
        for offset in range(4)
    ]

    assert [item["start_quantum"] for item in busy] == expected_starts
    assert [item["end_quantum"] for item in busy] == expected_ends
    assert all(item["resource_id"] == "u_5" for item in busy)


def test_project_recurring_busy_respects_stop_time():
    base_dt = datetime(2024, 1, 1, 0, 0)
    start_time = base_dt + timedelta(hours=9)
    end_time = start_time + timedelta(hours=1)
    search_start = base_dt
    search_end = base_dt + timedelta(days=5)
    stop_time = base_dt + timedelta(days=1, hours=12)

    busy = []
    meet_service.project_recurring_busy(
        busy,
        start_time,
        end_time,
        frequency="daily",
        search_start=search_start,
        search_end=search_end,
        base_dt=base_dt,
        resource_prefix="r",
        res_id=2,
        stop_time=stop_time,
    )

    assert len(busy) == 2
    assert all(item["resource_id"] == "r_2" for item in busy)


def test_project_recurring_busy_excludes_occurrence_at_stop_time():
    base_dt = datetime(2024, 1, 1, 0, 0)
    start_time = base_dt + timedelta(hours=12)
    end_time = start_time + timedelta(hours=1)
    search_start = base_dt
    search_end = base_dt + timedelta(days=3)
    stop_time = base_dt + timedelta(days=1, hours=12)

    busy = []
    meet_service.project_recurring_busy(
        busy,
        start_time,
        end_time,
        frequency="daily",
        search_start=search_start,
        search_end=search_end,
        base_dt=base_dt,
        resource_prefix="u",
        res_id=1,
        stop_time=stop_time,
    )

    assert len(busy) == 1
    assert busy[0]["start_quantum"] == meet_service.dt_to_quant(start_time, base_dt)
