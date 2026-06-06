from typing import List, Dict, Any

# Константи ваги штрафів
W_MAND = 1_000_000
W_OPT = 100

def build_availability_matrix(r_m: List[Dict[str, Any]], busy: List[Dict[str, int]], t_start: int, t_end: int) -> Dict[int, Dict[int, Dict[str, int]]]:
    """
    1. Побудова матриці доступності квантів B[r, t].
    Повертає словник, де ключ - ID ресурсу, а значення - словник квантів
    з накопиченим штрафом та ознакою критичної зайнятості.
    """
    b_matrix = {
        r["id"]: {
            t: {"penalty": 0, "critical": 0}
            for t in range(t_start, t_end + 1)
        }
        for r in r_m
    }
    
    for event in busy:
        r_id = event["resource_id"]
        if r_id in b_matrix:
            s = max(t_start, event["start_quantum"])
            e = min(t_end, event["end_quantum"])
            weight = event.get("weight", W_MAND)
            for t in range(s, e):
                if weight >= W_MAND:
                    b_matrix[r_id][t]["critical"] = 1
                else:
                    b_matrix[r_id][t]["penalty"] += weight
                
    return b_matrix

def group_similar_proposals(valid_slots: List[Dict[str, int]]) -> List[Dict[str, int]]:
    """
    5. Групування пропозицій з однаковим штрафом, що перетинаються.
    Повертає основні слоти з переліком підслотів.
    """
    grouped_slots = []

    for current_slot in valid_slots:
        assigned = False

        for accepted_slot in grouped_slots:
            overlap_start = max(current_slot["start_time"], accepted_slot["start_time"])
            overlap_end = min(current_slot["end_time"], accepted_slot["end_time"])

            if overlap_start <= overlap_end and current_slot["score"] == accepted_slot["score"]:
                accepted_slot["subslots"].append({
                    "start_time": current_slot["start_time"],
                    "end_time": current_slot["end_time"],
                    "score": current_slot["score"]
                })
                assigned = True
                break

        if not assigned:
            grouped_slots.append({
                "start_time": current_slot["start_time"],
                "end_time": current_slot["end_time"],
                "score": current_slot["score"],
                "subslots": []
            })

    return grouped_slots

def find_best_meeting_slots(d: int, t_start: int, t_end: int, r_m: List[Dict[str, Any]], busy: List[Dict[str, int]]) -> List[Dict[str, int]]:
    """
    Головна функція алгоритму планування.
    
    :param d: необхідна тривалість зустрічі (у кількості квантів)
    :param t_start: перший квант діапазону пошуку
    :param t_end: останній квант діапазону пошуку
    :param r_m: масив залучених ресурсів [{"id": 1, "weight": W_MAND}, ...]
    :param busy: масив існуючих зайнятостей [{"resource_id": 1, "start_quantum": 10, "end_quantum": 15}, ...]
    :return: ТОП-5 найкращих слотів
    """
    valid_slots = []
    
    # 1. Побудова матриці доступності
    b_matrix = build_availability_matrix(r_m, busy, t_start, t_end)
    
    # 2. Прохід ковзним вікном по осі часу
    for t in range(t_start, t_end - d + 2):
        penalty_score = 0
        is_critical_conflict = False
        
        # Перевірка кожного ресурсу
        for r in r_m:
            r_id = r["id"]
            
            for quantum in range(t, t + d):
                quantum_state = b_matrix[r_id][quantum]
                if quantum_state["critical"]:
                    is_critical_conflict = True
                    break
                penalty_score += quantum_state["penalty"]

            if is_critical_conflict:
                break
                    
        # 3. Збереження результату, якщо немає критичних конфліктів
        if not is_critical_conflict:
            slot = {
                "start_time": t,
                "end_time": t + d - 1,
                "score": penalty_score
            }
            valid_slots.append(slot)
            
    # 4. Обробка результатів
    if not valid_slots:
        return []
        
    # Сортування від найменшого штрафу до найбільшого
    valid_slots.sort(key=lambda x: x["score"])
    
    # 5. Групування перетинів з однаковим штрафом
    grouped_slots = group_similar_proposals(valid_slots)

    # Повертаємо перші 5 найкращих слотів (підслоти не рахуються)
    return grouped_slots[:5]
