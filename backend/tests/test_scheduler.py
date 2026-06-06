from app.algorithm.scheduler import (
    W_MAND,
    W_OPT,
    build_availability_matrix,
    find_best_meeting_slots,
    group_similar_proposals,
)


def test_build_availability_matrix_exclusive_end():
    resources = [{"id": 1}, {"id": 2}]
    busy = [{"resource_id": 1, "start_quantum": 1, "end_quantum": 3, "weight": W_MAND}]

    matrix = build_availability_matrix(resources, busy, t_start=0, t_end=4)

    assert matrix[1][0] == {"penalty": 0, "critical": 0}
    assert matrix[1][1] == {"penalty": 0, "critical": 1}
    assert matrix[1][2] == {"penalty": 0, "critical": 1}
    assert matrix[1][3] == {"penalty": 0, "critical": 0}
    assert all(matrix[2][t] == {"penalty": 0, "critical": 0} for t in range(0, 5))


def test_group_similar_proposals_merges_overlaps_with_same_score():
    slots = [
        {"start_time": 0, "end_time": 1, "score": 5},
        {"start_time": 1, "end_time": 2, "score": 5},
        {"start_time": 3, "end_time": 4, "score": 5},
        {"start_time": 0, "end_time": 1, "score": 10},
    ]

    grouped = group_similar_proposals(slots)

    assert len(grouped) == 3
    assert grouped[0]["start_time"] == 0
    assert grouped[0]["score"] == 5
    assert grouped[0]["subslots"] == [
        {"start_time": 1, "end_time": 2, "score": 5}
    ]
    assert grouped[1]["start_time"] == 3
    assert grouped[2]["score"] == 10


def test_find_best_meeting_slots_scores_and_grouping():
    resources = [
        {"id": 1, "weight": W_MAND},
        {"id": 2, "weight": W_OPT},
    ]
    busy = [
        {"resource_id": 1, "start_quantum": 2, "end_quantum": 3, "weight": W_MAND},
        {"resource_id": 2, "start_quantum": 0, "end_quantum": 2, "weight": W_OPT},
    ]

    slots = find_best_meeting_slots(
        d=2,
        t_start=0,
        t_end=5,
        r_m=resources,
        busy=busy,
    )

    assert len(slots) == 2

    first = slots[0]
    assert first["start_time"] == 3
    assert first["end_time"] == 4
    assert first["score"] == 0
    assert first["subslots"] == [
        {"start_time": 4, "end_time": 5, "score": 0}
    ]

    second = slots[1]
    assert second["start_time"] == 0
    assert second["end_time"] == 1
    assert second["score"] == 2 * W_OPT
