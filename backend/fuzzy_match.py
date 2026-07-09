"""
fuzzy_match.py — Jaccard Token Similarity cho AI Fuzzy Match
Dự án: KhoUNICE Web — HP Cons

Không dùng thư viện ngoài (chỉ stdlib) để giữ deployment đơn giản.
"""
import re
import unicodedata
from typing import Optional


# ── Chuẩn hóa đơn vị thường gặp trong vật tư xây dựng ────────
_UNIT_MAP = {
    # Độ dài
    r"\bmilimét\b": "mm",
    r"\bm\.?m\b": "mm",
    r"\bmét\b": "m",
    r"\bcm\b": "cm",
    # Khối lượng
    r"\bkilogam\b": "kg",
    r"\bký\b": "kg",
    r"\bkilo\b": "kg",
    r"\btấn\b": "t",
    # Diện tích
    r"\bm2\b": "m2",
    r"\bm²\b": "m2",
    r"\bm\^2\b": "m2",
    # Thể tích
    r"\blít\b": "l",
    r"\blit\b": "l",
    # Số thập phân: "0,35" → "0.35"; "0 35" → "0.35"
}

# Ký tự dấu câu cần giữ khoảng trắng (không xóa hẳn)
_PUNCT = re.compile(r"[/\\()\[\]{}<>:;,!?@#$%^&*+=|`~]")
# Nhiều khoảng trắng → 1
_SPACES = re.compile(r"\s+")


def remove_diacritics(text: str) -> str:
    """Bỏ dấu tiếng Việt và các diacritic Unicode."""
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if unicodedata.category(c) != "Mn")


def normalize(text: str) -> str:
    """
    Chuẩn hóa tên hàng hóa để so sánh fuzzy:
    1. Unicode normalize + bỏ dấu
    2. Lowercase
    3. Chuẩn hóa đơn vị (mm, m, kg, ...)
    4. Chuẩn hóa số thập phân ("0,35" → "0 35", "0.35" → "0 35")
    5. Loại bỏ ký tự đặc biệt → khoảng trắng
    6. Strip + dedupe khoảng trắng
    """
    if not text:
        return ""

    s = remove_diacritics(text).lower()

    # Chuẩn hóa đơn vị (áp dụng trước khi xóa ký tự)
    for pattern, replacement in _UNIT_MAP.items():
        s = re.sub(pattern, replacement, s, flags=re.IGNORECASE)

    # "0,35" hoặc "0.35" → "0 35" (để tokenize thành số riêng biệt)
    s = re.sub(r"(\d)[.,](\d)", r"\1 \2", s)

    # Dấu câu → khoảng trắng
    s = _PUNCT.sub(" ", s)

    # Gạch ngang giữa chữ → khoảng trắng; giữ "-" đầu số nếu có
    s = re.sub(r"(?<=\s)-|-(?=\s)", " ", s)
    s = s.replace("-", " ")

    # Xóa ký tự không phải alphanumeric/khoảng trắng
    s = re.sub(r"[^\w\s]", " ", s)

    # Dedupe khoảng trắng
    s = _SPACES.sub(" ", s).strip()

    return s


def tokenize(text: str) -> set[str]:
    """Tách chuỗi đã normalize thành tập tokens, bỏ stop-word ngắn."""
    tokens = text.split()
    # Bỏ token 1 ký tự (quá ngắn, gây nhiễu)
    return {t for t in tokens if len(t) > 1}


def jaccard_similarity(set_a: set, set_b: set) -> float:
    """Jaccard Token Similarity: |A ∩ B| / |A ∪ B|. Trả về 0.0–1.0."""
    if not set_a and not set_b:
        return 1.0
    if not set_a or not set_b:
        return 0.0
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return intersection / union


def fuzzy_score(text_a: str, text_b: str) -> int:
    """
    Tính điểm tương đồng giữa 2 tên hàng (đã normalize hoặc chưa).
    Trả về 0–100.

    Kết hợp 2 chiến lược:
    - Jaccard token (chính): đánh giá overlap từ
    - Prefix bonus: nếu cả 2 bắt đầu cùng từ → +5 điểm
    """
    na = normalize(text_a)
    nb = normalize(text_b)

    if na == nb:
        return 100

    ta = tokenize(na)
    tb = tokenize(nb)

    score = jaccard_similarity(ta, tb) * 100

    # Prefix bonus: từ đầu tiên giống nhau
    words_a = na.split()
    words_b = nb.split()
    if words_a and words_b and words_a[0] == words_b[0]:
        score = min(100, score + 5)

    return int(round(score))


def find_best_match(
    query: str,
    candidates: list[dict],
    text_field: str = "ten_hang",
    score_threshold: int = 0,
) -> Optional[tuple[dict, int]]:
    """
    Tìm candidate khớp tốt nhất với query.

    Args:
        query: Tên cần tìm (ten_ai_raw từ AI)
        candidates: List dict từ DB (vd: danh mục hàng hóa)
        text_field: Tên field chứa text để so sánh
        score_threshold: Ngưỡng tối thiểu (trả None nếu score < ngưỡng)

    Returns:
        (best_candidate_dict, score) hoặc None nếu không đủ ngưỡng
    """
    if not candidates or not query:
        return None

    best_item = None
    best_score = -1

    for item in candidates:
        candidate_text = item.get(text_field, "")
        if not candidate_text:
            continue
        score = fuzzy_score(query, candidate_text)
        if score > best_score:
            best_score = score
            best_item = item

    if best_item is None or best_score < score_threshold:
        return None

    return best_item, best_score


def classify_tab(score: int, green_threshold: int, yellow_threshold: int) -> str:
    """
    Phân loại tab dựa trên score:
    - score >= green_threshold → "green" (🟢)
    - score >= yellow_threshold → "yellow" (🟡)
    - score < yellow_threshold → "red" (🔴)
    """
    if score >= green_threshold:
        return "green"
    if score >= yellow_threshold:
        return "yellow"
    return "red"
