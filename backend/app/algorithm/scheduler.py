from typing import List, Dict, Any

# Константи ваги штрафів
W_MAND = 1_000_000
W_OPT = 10

def build_availability_matrix(r_m: List[Dict[str, Any]], busy: List[Dict[str, int]], t_start: int, t_end: int) -> Dict[int, Dict[int, int]]:
    """
    1. Побудова матриці доступності квантів B[r, t].
    Повертає словник, де ключ - ID ресурсу, а значення - словник квантів (0 - вільно, 1 - зайнято).
    """
    # Ініціалізуємо матрицю нулями для всіх ресурсів у вказаному діапазоні
    b_matrix = {r["id"]: {t: 0 for t in range(t_start, t_end + 1)} for r in r_m}
    
    # Заповнюємо матрицю зайнятими квантами на основі існуючих зустрічей
    for event in busy:
        r_id = event["resource_id"]
        if r_id in b_matrix:
            # Визначаємо межі перетину існуючої зустрічі з нашим діапазоном пошуку
            s = max(t_start, event["start_quantum"])
            e = min(t_end, event["end_quantum"])
            for t in range(s, e + 1):
                b_matrix[r_id][t] = 1
                
    return b_matrix

def filter_similar_proposals(valid_slots: List[Dict[str, int]]) -> List[Dict[str, int]]:
    """
    5. Забезпечення різноманіття пропозицій (Diversity Filter).
    Фільтрує слоти, що перетинаються між собою і мають однаковий бал штрафу.
    """
    final_slots = []
    
    for current_slot in valid_slots:
        is_overlapping = False
        
        for accepted_slot in final_slots:
            overlap_start = max(current_slot["start_time"], accepted_slot["start_time"])
            overlap_end = min(current_slot["end_time"], accepted_slot["end_time"])
            
            if overlap_start <= overlap_end:
                if current_slot["score"] == accepted_slot["score"]:
                    is_overlapping = True
                    break
                    
        if not is_overlapping:
            final_slots.append(current_slot)
            
    return final_slots

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
            resource_busy_time = 0
            r_id = r["id"]
            r_weight = r["weight"]
            
            # Внутрішній цикл: перевірка кожного кванта вікна
            for quantum in range(t, t + d):
                resource_busy_time += b_matrix[r_id][quantum]
                
            if resource_busy_time > 0:
                # Якщо вага ресурсу дорівнює або більша за обов'язкову
                if r_weight >= W_MAND:
                    is_critical_conflict = True
                    break  # Вікно не валідне, перериваємо перевірку ресурсів
                else:
                    # Нарахування штрафу за опціональний ресурс
                    penalty_score += resource_busy_time * r_weight
                    
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
    
    # 5. Забезпечення різноманіття пропозицій
    final_slots = filter_similar_proposals(valid_slots)
    
    # Повертаємо перші 5 найкращих слотів
    return final_slots[:5]
