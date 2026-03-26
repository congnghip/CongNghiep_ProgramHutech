"""
Syllabus PDF extraction service using Gemini AI
Refactored from syllabus_extractor_code.py for integration with FastAPI backend
"""

try:  # Optional dependency
    import pdfplumber  # type: ignore
except ModuleNotFoundError as exc:  # pragma: no cover - optional import guard
    pdfplumber = None  # type: ignore
    _PDFPLUMBER_IMPORT_ERROR = exc
else:
    _PDFPLUMBER_IMPORT_ERROR = None

try:  # Optional dependency
    import google.generativeai as genai  # type: ignore
except ModuleNotFoundError as exc:  # pragma: no cover - optional import guard
    genai = None  # type: ignore
    _GENAI_IMPORT_ERROR = exc
else:
    _GENAI_IMPORT_ERROR = None
import json
import os
import logging
import re
from uuid import uuid4
from typing import Dict, List, Optional, Any
from datetime import datetime
import tempfile
import shutil

# Configure logging
logger = logging.getLogger(__name__)


def _require_pdfplumber():
    """Return pdfplumber module or raise a helpful error."""
    if pdfplumber is None:
        message = (
            "pdfplumber is required for syllabus PDF extraction. "
            "Install the optional dependency with `pip install pdfplumber`."
        )
        if _PDFPLUMBER_IMPORT_ERROR:
            raise RuntimeError(message) from _PDFPLUMBER_IMPORT_ERROR
        raise RuntimeError(message)
    return pdfplumber


def _require_genai():
    """Return google.generativeai module or raise a helpful error."""
    if genai is None:
        message = (
            "google-generativeai is required for Gemini-powered syllabus parsing. "
            "Install it with `pip install google-generativeai`."
        )
        if _GENAI_IMPORT_ERROR:
            raise RuntimeError(message) from _GENAI_IMPORT_ERROR
        raise RuntimeError(message)
    return genai

VALID_BLOOM_LEVELS = {
    "remember",
    "understand",
    "apply",
    "analyze",
    "evaluate",
    "create",
}

BLOOM_SYNONYMS = {
    "knowledge": "remember",
    "nhớ": "remember",
    "recall": "remember",
    "comprehension": "understand",
    "hiểu": "understand",
    "apply": "apply",
    "vận dụng": "apply",
    "analysis": "analyze",
    "phân tích": "analyze",
    "evaluation": "evaluate",
    "đánh giá": "evaluate",
    "synthesis": "create",
    "tổng hợp": "create",
    "sáng tạo": "create",
}


def _ensure_str(value: Optional[Any], default: str = "") -> str:
    """Return a trimmed string or a default that satisfies schema constraints."""
    if isinstance(value, str):
        cleaned = value.strip()
        return cleaned if cleaned else default
    if value is None:
        return default
    cleaned = str(value).strip()
    return cleaned if cleaned else default


def _ensure_min_length(value: Optional[Any], min_length: int, fallback: str) -> str:
    """Ensure string meets minimum length requirements."""
    candidate = _ensure_str(value, fallback)
    return candidate if len(candidate) >= min_length else fallback


def _ensure_list_of_str(value: Optional[Any]) -> List[str]:
    """Normalize various list-like inputs to a list of trimmed strings."""
    if value is None:
        return []
    if isinstance(value, list):
        normalized = []
        for item in value:
            text = _ensure_str(item, "")
            if text:
                normalized.append(text)
        return normalized
    if isinstance(value, (set, tuple)):
        return [_ensure_str(item, "") for item in value if _ensure_str(item, "")]
    text = _ensure_str(value, "")
    if not text:
        return []
    text = text.replace("\r\n", "\n")
    if "\n" in text:
        parts = [part.strip() for part in text.split("\n")]
        parts = [part for part in parts if part]
        if parts:
            return parts
    if "," in text:
        parts = [part.strip() for part in text.split(",")]
        return [part for part in parts if part]
    return [text]


def _ensure_int(
    value: Optional[Any],
    default: int = 0,
    min_value: int = 0,
    max_value: Optional[int] = None,
) -> int:
    """Convert value to int within the allowed range."""
    try:
        if isinstance(value, bool):
            raise ValueError
        number = int(float(value))
    except (TypeError, ValueError):
        number = default
    if number < min_value:
        number = min_value
    if max_value is not None and number > max_value:
        number = max_value
    return number


def _normalize_bloom_level(value: Optional[Any]) -> str:
    """Map raw bloom level values to the allowed enum values."""
    normalized = _ensure_str(value, "").lower()
    if normalized in VALID_BLOOM_LEVELS:
        return normalized
    if normalized in BLOOM_SYNONYMS:
        return BLOOM_SYNONYMS[normalized]
    return "understand"


def _sanitize_version_component(value: Optional[Any], default: str) -> str:
    """Sanitize version components to allowed characters."""
    if value is None:
        return default
    cleaned = re.sub(r"[^A-Za-z0-9._-]", "-", str(value).strip())
    return cleaned or default


class PDFExtractor:
    """Extract text and tables from PDF syllabus"""
    
    def __init__(self, pdf_path: str):
        self.pdf_path = pdf_path
        self._pdfplumber = _require_pdfplumber()
    
    def extract_text(self) -> str:
        """Extract text content from PDF"""
        try:
            with self._pdfplumber.open(self.pdf_path) as pdf:
                text_content = ""
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text_content += page_text + "\n"
                return text_content.strip()
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {e}")
            raise
    
    def extract_tables(self) -> List[Dict]:
        """Extract tables from PDF"""
        try:
            tables = []
            with self._pdfplumber.open(self.pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    page_tables = page.extract_tables()
                    for table_num, table in enumerate(page_tables, 1):
                        if table:
                            tables.append({
                                "page": page_num,
                                "table": table_num,
                                "data": table
                            })
            return tables
        except Exception as e:
            logger.error(f"Error extracting tables from PDF: {e}")
            return []
    
    def identify_sections(self) -> Dict:
        """Identify syllabus sections from text content"""
        text = self.extract_text()
        
        # Common Vietnamese syllabus section patterns
        section_patterns = {
            "course_info": ["thông tin môn học", "course information", "mã môn học", "course code"],
            "objectives": ["mục tiêu", "objectives", "chuẩn đầu ra", "learning outcomes"],
            "description": ["mô tả", "description", "tóm tắt", "summary"],
            "prerequisites": ["học phần học trước", "prerequisites", "điều kiện tiên quyết"],
            "outline": ["đề cương", "outline", "nội dung", "content", "tuần", "week"],
            "assessment": ["đánh giá", "assessment", "kiểm tra", "thi", "điểm"],
            "textbooks": ["tài liệu", "textbook", "sách", "reference", "tham khảo"],
            "requirements": ["yêu cầu", "requirements", "phương pháp", "methods"]
        }
        
        sections = {}
        text_lower = text.lower()
        
        for section_name, patterns in section_patterns.items():
            for pattern in patterns:
                if pattern in text_lower:
                    sections[section_name] = True
                    break
        
        return sections


class SyllabusParser:
    """Parse syllabus using Gemini AI"""
    
    def __init__(self, api_key: str, model_name: str = "gemini-2.0-flash-exp"):
        genai_module = _require_genai()
        genai_module.configure(api_key=api_key)
        self.model = genai_module.GenerativeModel(model_name)
    
    def create_extraction_prompt(self, pdf_text: str, sections: Dict) -> str:
        """Create prompt for Gemini to extract structured syllabus data"""
        return f"""
Bạn là chuyên gia phân tích đề cương môn học. Hãy trích xuất thông tin từ đề cương sau và trả về dưới dạng JSON chính xác.

Văn bản đề cương:
{pdf_text[:8000]}  # Limit text to avoid token limits

Các nhóm mục đã nhận diện sơ bộ từ tài liệu:
{json.dumps(sections, ensure_ascii=False)}

Yêu cầu trích xuất:

1. THÔNG TIN CƠ BẢN:
- course_code: Mã môn học (VD: CMP167, CS101)
- course_name: Tên môn học
- credits: Số tín chỉ
- language_instruction: Ngôn ngữ giảng dạy (vi/en)

2. CHUẨN ĐẦU RA (CLOs):
Trích xuất tất cả chuẩn đầu ra với format:
- code: Mã CLO (VD: CLO1, CLO2)
- description: Mô tả chi tiết
- bloom_level: Mức độ Bloom (remember/understand/apply/analyze/evaluate/create)
- plo_mapping: Danh sách PLO liên quan (nếu có)

3. ĐỀ CƯƠNG CHI TIẾT (course_outline):
Trích xuất theo tuần với format:
- week: Số tuần
- topic: Chủ đề
- content: Nội dung chi tiết
- hours: {{"theory": X, "practice": Y}}
- teaching_method: Phương pháp giảng dạy
- materials: Tài liệu sử dụng
- clo_mapping: CLO liên quan
- assignments: Bài tập

4. PHƯƠNG PHÁP ĐÁNH GIÁ (assessment_methods):
- type: Loại đánh giá (VD: "Chuyên cần", "Bài tập", "Kiểm tra giữa kỳ", "Thi cuối kỳ")
- weight: Trọng số (phần trăm)
- description: Mô tả chi tiết
- criteria: Tiêu chí đánh giá
- clo_mapping: CLO được đánh giá

5. TÀI LIỆU (textbooks & references):
- type: "main" hoặc "reference"
- title: Tên sách/tài liệu
- authors: Danh sách tác giả
- year: Năm xuất bản
- publisher: Nhà xuất bản
- isbn: Mã ISBN (nếu có)
- edition: Lần xuất bản

6. YÊU CẦU KHÁC:
- prerequisites: Học phần học trước
- course_objectives: Mục tiêu môn học
- course_description: Mô tả tóm tắt
- learning_methods: Phương pháp học tập
- course_requirements: Yêu cầu về phần mềm, phần cứng
- sections: Sao chép lại các nhóm mục đã nhận diện được nếu hữu ích
- source_file: Tên file nguồn nếu văn bản có đề cập
- version_number: Phiên bản đề cương nếu tài liệu có ghi

7. BỔ SUNG CHO CLO:
- assessment_methods: Danh sách loại đánh giá liên quan tới từng CLO nếu suy ra được từ ma trận CLO-Assessment hoặc mô tả đánh giá

8. QUY TẮC NHẬN DIỆN THUẬT NGỮ TƯƠNG ĐƯƠNG:
- "Chuẩn đầu ra học phần", "CLO", "Learning Outcomes", "CĐR học phần" => clos
- "Đề cương chi tiết", "Kế hoạch giảng dạy", "Lịch trình giảng dạy", "Course outline", "Nội dung giảng dạy theo tuần" => course_outline
- "Đánh giá", "Assessment", "Thành phần điểm", "Cách tính điểm", "Rubric", "Hình thức kiểm tra" => assessment_methods
- "Tài liệu chính", "Giáo trình", "Tài liệu học tập chính" => textbooks
- "Tài liệu tham khảo", "Reference", "Đọc thêm" => references
- "Điều kiện tiên quyết", "Học phần tiên quyết", "Prerequisite" => prerequisites
- "Phương pháp dạy học", "Phương pháp học tập", "Teaching methods", "Learning methods" => learning_methods hoặc teaching_method tùy ngữ cảnh

9. QUY TẮC XỬ LÝ TÌNH HUỐNG PHỨC TẠP:
- Tài liệu có thể bị lỗi OCR, xuống dòng sai, lệch cột bảng, thiếu dấu, lặp tiêu đề, hoặc ghép nhầm ô. Hãy suy luận cẩn thận nhưng KHÔNG bịa dữ liệu.
- Nếu cùng một thông tin xuất hiện ở nhiều nơi và mâu thuẫn nhau, ưu tiên theo thứ tự:
  1. Bảng thông tin học phần chính thức
  2. Phần mô tả/giới thiệu môn học
  3. Header/footer hoặc phụ lục
- Nếu course_code, course_name, credits, language_instruction bị tách nhiều dòng, hãy ghép lại hợp lý.
- Nếu CLO không ghi rõ mã nhưng có danh sách chuẩn đầu ra theo thứ tự, tự gán CLO1, CLO2, ... theo thứ tự xuất hiện.
- Nếu Bloom level không ghi trực tiếp nhưng có động từ hành động, suy ra mức phù hợp nhất trong 6 mức:
  remember, understand, apply, analyze, evaluate, create
- Nếu đề cương ghi theo buổi/chương/chủ đề thay vì tuần, hãy ánh xạ sang `week` theo thứ tự xuất hiện bắt đầu từ 1.
- Nếu một tuần có nhiều dòng con, gộp chúng thành một object của tuần đó.
- Nếu giờ lý thuyết/thực hành không tách rõ, đặt số không tìm thấy là 0, không tự chia đoán tùy ý.
- Nếu có bảng ma trận CLO-PLO hoặc CLO-Assessment, hãy tận dụng để điền `plo_mapping`, `clo_mapping`, và `assessment_methods`.
- Nếu đánh giá ghi theo tỷ lệ như "0.3", "30%", "30 / 100", hãy chuẩn hóa về số phần trăm nguyên hoặc số phù hợp trong trường `weight`.
- Nếu tổng trọng số hiện trong tài liệu không đúng 100 do lỗi OCR nhỏ nhưng có thể suy ra rõ ràng, hãy sửa về giá trị hợp lý nhất.
- Nếu không thể suy ra chắc chắn, giữ nguyên dữ liệu tìm được thay vì bịa để đủ 100.
- Nếu tài liệu có cả tiếng Việt và tiếng Anh, ưu tiên giữ nguyên tên trường ở ngôn ngữ xuất hiện chính trong tài liệu; không cần dịch.
- Nếu tài liệu có thông tin lặp giữa bảng và đoạn văn, hãy hợp nhất nhưng không nhân đôi phần tử.

10. QUY TẮC CHUẨN HÓA OUTPUT:
- Trả về đúng MỘT object JSON duy nhất, không giải thích, không markdown, không chú thích.
- Tất cả key ở object gốc phải luôn tồn tại, kể cả khi giá trị là null, "", {{}}, hoặc [].
- Với field kiểu list, nếu không có dữ liệu thì trả [].
- Với field kiểu object như `course_requirements`, luôn trả đủ các key con: software, hardware, lab_equipment, classroom_setup.
- `language_instruction` chỉ nên là "vi", "en", hoặc chuỗi ngắn gọn tương đương nếu tài liệu ghi rõ song ngữ.
- `clos[].code` phải duy nhất.
- `clos[].plo_mapping`, `course_outline[].clo_mapping`, `assessment_methods[].clo_mapping`, `clos[].assessment_methods`, `course_outline[].materials`, `course_outline[].assignments` phải là array.
- `course_outline[].hours` luôn là object có 2 key: theory, practice.
- `week` phải là số nguyên dương.
- `credits` nên là số; nếu tài liệu ghi "3(2,1)" thì trích `credits = 3`, còn phân bổ giờ đưa vào course_outline nếu có bằng chứng.
- Không tạo textbook/reference giả nếu tài liệu hoàn toàn không có; để [].
- Không tự sinh PLO nếu tài liệu không có dấu hiệu liên kết rõ ràng.
- Nếu một mục không chắc chắn, ưu tiên giữ mô tả ở field text hơn là suy diễn sang field cấu trúc sai.

LƯU Ý QUAN TRỌNG:
- Tổng trọng số đánh giá phải = 100%
- CLO codes phải duy nhất
- Week numbers phải tuần tự
- Trả về JSON hợp lệ, không có markdown formatting
- Nếu không tìm thấy thông tin, để null hoặc array rỗng

Trả về JSON với cấu trúc:
{{
  "course_code": "string",
  "course_name": "string", 
  "credits": number,
  "language_instruction": "string",
  "clos": [...],
  "course_outline": [...],
  "assessment_methods": [...],
  "textbooks": [...],
  "references": [...],
  "prerequisites": "string",
  "course_objectives": "string",
  "course_description": "string", 
  "learning_methods": "string",
  "sections": {{}},
  "source_file": "string",
  "version_number": "string",
  "course_requirements": {{
    "software": [...],
    "hardware": [...],
    "lab_equipment": [...],
    "classroom_setup": "string"
  }}
}}
"""
    
    def parse_syllabus(self, pdf_text: str, sections: Dict) -> Dict:
        """Parse syllabus using Gemini AI"""
        try:
            prompt = self.create_extraction_prompt(pdf_text, sections)
            
            response = self.model.generate_content(prompt)
            
            if not response.text:
                raise ValueError("Empty response from Gemini")
            
            # Extract JSON from response (handle markdown fences)
            response_text = response.text.strip()
            
            # Remove markdown code fences if present
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            response_text = response_text.strip()
            
            # Parse JSON
            try:
                parsed_data = json.loads(response_text)
            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error: {e}")
                logger.error(f"Response text: {response_text[:500]}...")
                raise ValueError(f"Invalid JSON response from AI: {e}")
            
            return parsed_data
            
        except Exception as e:
            logger.error(f"Error parsing syllabus with Gemini: {e}")
            raise
    
    def validate_parsed_data(self, data: Dict) -> tuple[bool, List[str]]:
        """Validate parsed syllabus data"""
        errors = []
        
        # Check required fields
        required_fields = ["course_code", "course_name"]
        for field in required_fields:
            if not data.get(field):
                errors.append(f"Missing required field: {field}")
        
        # Validate assessment weights sum to 100
        assessment_methods = data.get("assessment_methods", [])
        if assessment_methods:
            total_weight = sum(method.get("weight", 0) for method in assessment_methods)
            if total_weight != 100:
                errors.append(f"Assessment weights must sum to 100 (current: {total_weight})")
        
        # Validate CLO codes are unique
        clos = data.get("clos", [])
        if clos:
            clo_codes = [clo.get("code") for clo in clos if clo.get("code")]
            if len(set(clo_codes)) != len(clo_codes):
                errors.append("Duplicate CLO codes found")
        
        # Validate week sequence
        outline = data.get("course_outline", [])
        if outline:
            weeks = [week.get("week") for week in outline if week.get("week")]
            if weeks != sorted(weeks):
                errors.append("Week numbers must be in sequential order")
        
        return len(errors) == 0, errors


def extract_syllabus_from_pdf(pdf_path: str, api_key: str, model_name: str = "gemini-2.0-flash-exp") -> Dict[str, Any]:
    """
    Main function to extract syllabus data from PDF
    
    Args:
        pdf_path: Path to PDF file
        api_key: Gemini API key
        model_name: Gemini model name
        
    Returns:
        Dict containing extracted syllabus data compatible with SyllabusCreateSchema
        
    Raises:
        ValueError: If extraction or validation fails
        Exception: For other errors
    """
    try:
        logger.info(f"Starting syllabus extraction from: {pdf_path}")
        
        # Initialize components
        extractor = PDFExtractor(pdf_path)
        parser = SyllabusParser(api_key, model_name)
        
        # Extract text and identify sections
        pdf_text = extractor.extract_text()
        if not pdf_text:
            raise ValueError("No text content found in PDF")
        
        sections = extractor.identify_sections()
        logger.info(f"Identified sections: {list(sections.keys())}")
        
        # Parse with Gemini
        parsed_data = parser.parse_syllabus(pdf_text, sections)
        
        # Validate parsed data
        is_valid, errors = parser.validate_parsed_data(parsed_data)
        if not is_valid:
            raise ValueError(f"Validation failed: {'; '.join(errors)}")
        
        # Transform to match SyllabusCreateSchema format
        transformed_data = transform_to_syllabus_schema(parsed_data)
        
        logger.info("Syllabus extraction completed successfully")
        return transformed_data
        
    except Exception as e:
        logger.error(f"Syllabus extraction failed: {e}")
        raise


def transform_to_syllabus_schema(parsed_data: Dict) -> Dict[str, Any]:
    """Transform parsed data to match SyllabusCreateSchema format."""

    base_version = _sanitize_version_component(parsed_data.get("version_number"), "1.0")
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    random_suffix = uuid4().hex[:4]
    version_number = f"{base_version}-{timestamp}-{random_suffix}"
    extracted_course_code = _ensure_str(parsed_data.get("course_code"), "")
    extracted_course_name = _ensure_str(parsed_data.get("course_name"), "")

    clos = []
    used_codes = set()
    for index, clo in enumerate(parsed_data.get("clos", []), start=1):
        fallback_code = f"CLO{index}"
        code_candidate = _ensure_min_length(clo.get("code"), 1, fallback_code)
        code = code_candidate
        suffix = 1
        while code in used_codes:
            code = f"{code_candidate}_{suffix}"
            suffix += 1
        used_codes.add(code)
        clos.append(
            {
                "code": code,
                "description": _ensure_min_length(
                    clo.get("description"),
                    10,
                    "Details to be updated.",
                ),
                "bloom_level": _normalize_bloom_level(clo.get("bloom_level")),
                "plo_mapping": _ensure_list_of_str(clo.get("plo_mapping")),
                "assessment_methods": _ensure_list_of_str(
                    clo.get("assessment_methods")
                ),
            }
        )

    course_outline = []
    used_weeks = set()
    for index, week in enumerate(parsed_data.get("course_outline", []), start=1):
        target_week = _ensure_int(week.get("week"), default=index, min_value=1, max_value=52)
        candidate_week = target_week
        while candidate_week in used_weeks and candidate_week <= 52:
            candidate_week += 1
        if candidate_week > 52:
            candidate_week = max(1, index)
        used_weeks.add(candidate_week)

        hours_data = week.get("hours") if isinstance(week.get("hours"), dict) else {}
        course_outline.append(
            {
                "week": candidate_week,
                "topic": _ensure_min_length(
                    week.get("topic"),
                    5,
                    f"Week {candidate_week} topic TBD",
                ),
                "content": _ensure_min_length(
                    week.get("content"),
                    10,
                    "Content to be updated.",
                ),
                "hours": {
                    "theory": _ensure_int(
                        (hours_data or {}).get("theory"),
                        default=0,
                        min_value=0,
                        max_value=20,
                    ),
                    "practice": _ensure_int(
                        (hours_data or {}).get("practice"),
                        default=0,
                        min_value=0,
                        max_value=20,
                    ),
                },
                "teaching_method": _ensure_min_length(
                    week.get("teaching_method"),
                    3,
                    "TBD",
                ),
                "materials": _ensure_list_of_str(week.get("materials")),
                "clo_mapping": _ensure_list_of_str(week.get("clo_mapping")),
                "assignments": _ensure_list_of_str(week.get("assignments")),
            }
        )

    assessment_methods = []
    for index, method in enumerate(parsed_data.get("assessment_methods", []), start=1):
        assessment_methods.append(
            {
                "type": _ensure_min_length(
                    method.get("type"),
                    3,
                    f"Assessment {index}",
                ),
                "weight": _ensure_int(
                    method.get("weight"),
                    default=0,
                    min_value=0,
                    max_value=100,
                ),
                "description": _ensure_min_length(
                    method.get("description"),
                    10,
                    "Details to be updated.",
                ),
                "criteria": _ensure_str(
                    method.get("criteria"),
                    "Criteria to be updated.",
                ),
                "clo_mapping": _ensure_list_of_str(method.get("clo_mapping")),
            }
        )

    textbooks = []
    references = []
    current_year = datetime.now().year

    for index, item in enumerate(parsed_data.get("textbooks", []), start=1):
        authors = _ensure_list_of_str(item.get("authors"))
        if not authors:
            authors = ["Faculty"]
        textbooks.append(
            {
                "type": "main",
                "title": _ensure_min_length(
                    item.get("title"),
                    5,
                    f"Primary Textbook {index}",
                ),
                "authors": authors,
                "year": _ensure_int(
                    item.get("year"),
                    default=current_year,
                    min_value=1900,
                    max_value=current_year + 5,
                ),
                "publisher": _ensure_min_length(
                    item.get("publisher"),
                    3,
                    "TBD Publisher",
                ),
                "isbn": _ensure_str(item.get("isbn"), ""),
                "edition": _ensure_str(item.get("edition"), ""),
            }
        )

    for index, item in enumerate(parsed_data.get("references", []), start=1):
        authors = _ensure_list_of_str(item.get("authors"))
        if not authors:
            authors = ["Faculty"]
        references.append(
            {
                "type": "reference",
                "title": _ensure_min_length(
                    item.get("title"),
                    5,
                    f"Reference Material {index}",
                ),
                "authors": authors,
                "year": _ensure_int(
                    item.get("year"),
                    default=current_year,
                    min_value=1900,
                    max_value=current_year + 5,
                ),
                "publisher": _ensure_min_length(
                    item.get("publisher"),
                    3,
                    "TBD Publisher",
                ),
                "isbn": _ensure_str(item.get("isbn"), ""),
                "edition": _ensure_str(item.get("edition"), ""),
            }
        )

    course_requirements = parsed_data.get("course_requirements", {})
    if not isinstance(course_requirements, dict):
        course_requirements = {}

    metadata_sections = []
    if isinstance(parsed_data.get("sections"), dict):
        metadata_sections = list(parsed_data["sections"].keys())

    metadata = {
        "extraction_date": datetime.now().isoformat(),
        "source_file": os.path.basename(parsed_data.get("source_file", "")),
        "extraction_method": "gemini_ai",
        "sections_identified": metadata_sections,
        "extracted_course_code": extracted_course_code,
        "extracted_course_name": extracted_course_name,
        "original_version_number": _ensure_str(parsed_data.get("version_number"), ""),
        "generated_version_token": random_suffix,
    }

    return {
        "version_number": version_number,
        "version_name": f"Imported from PDF - {parsed_data.get('course_name', 'Unknown')} ({timestamp})",
        "course_objectives": _ensure_str(parsed_data.get("course_objectives"), ""),
        "course_description": _ensure_str(parsed_data.get("course_description"), ""),
        "prerequisites": _ensure_str(parsed_data.get("prerequisites"), ""),
        "learning_methods": _ensure_str(parsed_data.get("learning_methods"), ""),
        "language_instruction": _ensure_str(parsed_data.get("language_instruction"), "vi"),
        "clos": clos,
        "course_outline": course_outline,
        "assessment_methods": assessment_methods,
        "textbooks": textbooks,
        "references": references,
        "course_requirements": {
            "software": _ensure_list_of_str(course_requirements.get("software")),
            "hardware": _ensure_list_of_str(course_requirements.get("hardware")),
            "lab_equipment": _ensure_list_of_str(course_requirements.get("lab_equipment")),
            "classroom_setup": _ensure_str(course_requirements.get("classroom_setup"), ""),
        },
        "metadata": metadata,
        "extracted_course_code": extracted_course_code,
        "extracted_course_name": extracted_course_name,
    }
