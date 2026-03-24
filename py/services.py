"""Service layer for DOCX import functionality"""
import json
import logging
import re
import unicodedata
from typing import Dict, List, Optional, Tuple, Set
from datetime import datetime

from app.db import db
from .schemas import (
    CurriculumImportData,
    ProgramImportData,
    ProgramVersionImportData,
    ProgramObjectiveImportData,
    LearningOutcomeImportData,
    PLOPOMapImportData,
    AdmissionCriteriaImportData,
    KnowledgeBlockImportData,
    CourseGroupImportData,
    CourseImportData,
    ProgramCoursePlacementImportData,
    CoursePLOContributionImportData
)

logger = logging.getLogger(__name__)

_PI_FORMAT_PATTERN = re.compile(r"^PI\d+\.\d+$", re.IGNORECASE)
_DEFAULT_INVALID_STRUCTURE_KEYS = {
    "chua phan nhom",
    "unknown",
    "unknown group",
    "not assigned",
    "unassigned",
    "n/a",
}


def normalize_performance_indicator_value(
    plo_code: str,
    raw_indicator: Optional[str],
    fallback_level: Optional[int] = None,
) -> str:
    indicator = (raw_indicator or "").replace("\xa0", " ")
    indicator = re.sub(r"\s+", " ", indicator).strip()
    indicator_upper = indicator.upper()
    if indicator_upper and _PI_FORMAT_PATTERN.match(indicator_upper):
        numbers = re.findall(r"\d+", indicator_upper)
        major = numbers[0] if numbers else "1"
        minor = numbers[1] if len(numbers) >= 2 else (str(fallback_level) if fallback_level is not None else "1")
        major = major.lstrip("0") or "0"
        minor = minor.lstrip("0") or "0"
        return f"PI{major}.{minor}"

    tokens = [token for token in re.split(r"[^\w]+", indicator_upper) if token]
    digits: List[str] = []
    for token in tokens:
        if token.startswith("PLO"):
            continue
        if token == "PI":
            continue
        if token.startswith("PI") and token[2:].isdigit():
            digits.append(token[2:])
            continue
        if token.isdigit():
            digits.append(token)

    plo_clean = re.sub(r"\s+", "", (plo_code or "").upper())
    plo_digits = re.findall(r"\d+", plo_clean)
    major = digits[0] if digits else (plo_digits[0] if plo_digits else None)
    minor = digits[1] if len(digits) >= 2 else None

    if not major and plo_digits:
        major = plo_digits[0]
    if not major:
        major = "1"

    if not minor:
        if fallback_level is not None:
            minor = str(fallback_level)
        elif digits:
            minor = digits[0]
        elif plo_digits:
            minor = plo_digits[0]
        else:
            minor = "1"

    if major.isdigit():
        major = str(int(major))
    if minor.isdigit():
        minor = str(int(minor))

    return f"PI{major}.{minor}"


class DocxImportService:
    """Service for handling DOCX import operations"""
    
    def __init__(self):
        self.transaction_id = None
        self._invalid_name_keys = set(_DEFAULT_INVALID_STRUCTURE_KEYS)
        self._initialize_counters()
    
    async def import_curriculum_data(self, data: CurriculumImportData, user_id: int) -> Tuple[bool, Dict[str, List[int]], Dict[str, int], List[str], Optional[str]]:
        """Import curriculum data in a single transaction"""
        self.transaction_id = f"import_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{user_id}"
        errors = []
        
        try:
            async with db.transaction():
                # Initialize counters
                self._initialize_counters()
                
                # 1. Create Program
                program_id = await self._create_program(data.program, user_id)
                if not program_id:
                    raise Exception("Không thể tạo chương trình mới.")
                
                # 2. Create Program Version
                version_id = await self._create_program_version(data.program_version, program_id, user_id)
                if not version_id:
                    raise Exception("Không thể tạo phiên bản chương trình.")
                
                # 3. Create Program Objectives
                await self._create_program_objectives(data.program_objectives, version_id, user_id)
                
                # 4. Create Learning Outcomes
                await self._create_learning_outcomes(data.learning_outcomes, version_id, user_id)
                
                # 5. Create PLO-PO Mapping
                await self._create_plo_po_mapping(data.plo_po_map, version_id, user_id)
                
                # 6. Create Admission Criteria
                if data.admission_criteria:
                    await self._create_admission_criteria(data.admission_criteria, version_id, user_id)
                
                # 7. Create Knowledge Structure
                await self._create_knowledge_structure(
                    data.knowledge_blocks, 
                    data.course_groups, 
                    version_id, 
                    user_id
                )
                
                # 8. Create Courses (only if not exists)
                await self._create_courses(data.courses, user_id)
                
                # 9. Create Course Placements
                await self._create_course_placements(data.program_course_placement, version_id, user_id)
                
                # 10. Create Course-PLO Contributions
                await self._create_course_plo_contributions(data.course_plo_contribution, version_id, user_id)
                
                logger.info(f"Successfully imported curriculum data with transaction ID: {self.transaction_id}")
                return True, self.created_ids, self.counts, errors, self.transaction_id
                
        except Exception as e:
            logger.error(f"Failed to import curriculum data: {e}")
            errors.append(f"Giao dịch nhập liệu thất bại: {str(e)}")
            return False, {}, {}, errors, self.transaction_id
    
    def _initialize_counters(self):
        """Initialize counters for tracking created records"""
        self.created_ids = {
            'program': [],
            'program_version': [],
            'program_objective': [],
            'learning_outcome': [],
            'plo_po_map': [],
            'admission_criteria': [],
            'knowledge_block': [],
            'course_group': [],
            'course': [],
            'program_course_placement': [],
            'course_plo_contribution': []
        }
        self.counts = {
            'program': 0,
            'program_version': 0,
            'program_objective': 0,
            'learning_outcome': 0,
            'plo_po_map': 0,
            'admission_criteria': 0,
            'knowledge_block': 0,
            'course_group': 0,
            'course': 0,
            'program_course_placement': 0,
            'course_plo_contribution': 0
        }
        self.po_code_to_id: Dict[str, int] = {}
        self.plo_code_to_id: Dict[str, int] = {}
        self.block_name_to_id: Dict[str, int] = {}
        self.group_name_to_id: Dict[str, int] = {}
        self.course_code_to_id: Dict[str, int] = {}
        self.placement_course_map: Dict[str, List[int]] = {}
        self.invalid_block_keys: Set[str] = set()
        self.invalid_group_keys: Set[str] = set()
        self.processed_placement_keys: Set[Tuple[int, Optional[int], Optional[int]]] = set()

    @staticmethod
    def _normalize_structure_name(name: Optional[str]) -> str:
        if not name:
            return ""
        normalized = unicodedata.normalize("NFKD", name)
        normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch))
        normalized = re.sub(r"\s+", " ", normalized).strip().lower()
        return normalized

    def _is_invalid_block_key(self, key: str) -> bool:
        return not key or key in self._invalid_name_keys or key in self.invalid_block_keys

    def _is_invalid_group_key(self, key: str) -> bool:
        return not key or key in self._invalid_name_keys or key in self.invalid_group_keys

    async def _resolve_version_number(self, program_id: int, proposed: Optional[str]) -> str:
        """Determine a unique version number for the program."""
        if proposed and proposed.lower() not in {"auto", "autogen"}:
            duplicate = await db.fetch_one(
                """
                SELECT id FROM program_version
                WHERE program_id = :program_id
                  AND LOWER(version_number) = LOWER(:version_number)
                  AND deleted_at IS NULL
                """,
                {"program_id": program_id, "version_number": proposed}
            )
            if duplicate:
                raise Exception(f"Phiên bản '{proposed}' đã tồn tại cho chương trình này.")
            return proposed

        existing_versions = await db.fetch_all(
            """
            SELECT version_number
            FROM program_version
            WHERE program_id = :program_id
              AND deleted_at IS NULL
            """,
            {"program_id": program_id}
        )

        sequences = []
        for row in existing_versions:
            version_number = row["version_number"] or ""
            parts = version_number.split("-")
            if len(parts) == 2 and parts[1].isdigit():
                sequences.append(int(parts[1]))

        next_sequence = max(sequences) + 1 if sequences else 1
        year = datetime.now().year
        return f"{year}-{next_sequence}"

    async def _get_course_id(self, course_code: str) -> Optional[int]:
        code_key = course_code.upper()
        if code_key in self.course_code_to_id:
            return self.course_code_to_id[code_key]
        result = await db.fetch_one(
            "SELECT id FROM course WHERE code = :code AND deleted_at IS NULL",
            {"code": course_code}
        )
        if result:
            self.course_code_to_id[code_key] = result["id"]
            return result["id"]
        return None

    async def _get_course_details(self, course_code: str) -> Optional[dict]:
        """Fetch full course details from database"""
        result = await db.fetch_one(
            "SELECT id, code, name, en_name, default_total_credits, default_lecture_credits, "
            "default_practical_credits, default_project_credits, default_internship_credits "
            "FROM course WHERE code = :code AND deleted_at IS NULL",
            {"code": course_code}
        )
        return dict(result) if result else None

    async def _get_course_group_id(self, group_name: Optional[str], version_id: int) -> Optional[int]:
        if not group_name:
            return None
        key = self._normalize_structure_name(group_name)
        if self._is_invalid_group_key(key):
            self.invalid_group_keys.add(key)
            return None
        if key in self.group_name_to_id:
            return self.group_name_to_id[key]
        result = await db.fetch_one(
            """
            SELECT id FROM course_group
            WHERE version_id = :version_id
              AND LOWER(name) = LOWER(:name)
              AND deleted_at IS NULL
            """,
            {"version_id": version_id, "name": group_name}
        )
        if result:
            self.group_name_to_id[key] = result["id"]
            return result["id"]
        self.invalid_group_keys.add(key)
        return None

    async def _get_knowledge_block_id(self, block_name: Optional[str], version_id: int) -> Optional[int]:
        if not block_name:
            return None
        key = self._normalize_structure_name(block_name)
        if self._is_invalid_block_key(key):
            self.invalid_block_keys.add(key)
            return None
        if key in self.block_name_to_id:
            return self.block_name_to_id[key]
        result = await db.fetch_one(
            """
            SELECT id FROM knowledge_block
            WHERE version_id = :version_id
              AND LOWER(name) = LOWER(:name)
              AND deleted_at IS NULL
            """,
            {"version_id": version_id, "name": block_name}
        )
        if result:
            self.block_name_to_id[key] = result["id"]
            return result["id"]
        self.invalid_block_keys.add(key)
        return None
    
    async def _create_program(self, program_data: ProgramImportData, user_id: int) -> Optional[int]:
        """Create program record"""
        try:
            # Ensure program code not already used
            existing_program = await db.fetch_one(
                "SELECT id FROM program WHERE LOWER(code) = LOWER(:code) AND deleted_at IS NULL",
                {"code": program_data.code}
            )
            if existing_program:
                raise Exception(f"Chương trình với mã '{program_data.code}' đã tồn tại.")

            # Get faculty ID
            faculty_query = "SELECT id FROM faculty WHERE LOWER(name) = LOWER(:faculty_name) AND deleted_at IS NULL"
            faculty_result = await db.fetch_one(faculty_query, {"faculty_name": program_data.faculty_name})
            
            if not faculty_result:
                raise Exception(f"Không tìm thấy khoa/đơn vị: {program_data.faculty_name}")
            
            faculty_id = faculty_result['id']
            
            # Create program
            query = """
                INSERT INTO program (
                    code, vn_name, en_name, awarding_institution, degree_title, 
                    degree_level, study_mode, faculty_id, metadata, created_by
                ) VALUES (
                    :code, :vn_name, :en_name, :awarding_institution, :degree_title,
                    :degree_level, :study_mode, :faculty_id, :metadata::jsonb, :created_by
                ) RETURNING id
            """
            
            params = {
                "code": program_data.code,
                "vn_name": program_data.vn_name,
                "en_name": program_data.en_name,
                "awarding_institution": program_data.awarding_institution,
                "degree_title": program_data.degree_title,
                "degree_level": program_data.degree_level,
                "study_mode": program_data.study_mode,
                "faculty_id": faculty_id,
                "metadata": program_data.metadata,
                "created_by": user_id
            }
            
            result = await db.fetch_one(query, params)
            program_id = result['id']
            
            self.created_ids['program'].append(program_id)
            self.counts['program'] += 1
            
            logger.info(f"Created program: {program_data.code} (ID: {program_id})")
            return program_id
            
        except Exception as e:
            logger.error(f"Error creating program: {e}")
            raise
    
    async def _create_program_version(self, version_data: ProgramVersionImportData, program_id: int, user_id: int) -> Optional[int]:
        """Create program version record"""
        try:
            version_number = await self._resolve_version_number(program_id, version_data.version_number)

            query = """
                INSERT INTO program_version (
                    program_id, version_number, version_name, total_credits, duration,
                    status, effective_date, change_type, metadata, created_by
                ) VALUES (
                    :program_id, :version_number, :version_name, :total_credits, :duration,
                    :status, :effective_date, :change_type, :metadata::jsonb, :created_by
                ) RETURNING id
            """
            
            params = {
                "program_id": program_id,
                "version_number": version_number,
                "version_name": version_data.version_name,
                "total_credits": version_data.total_credits,
                "duration": version_data.duration,
                "status": version_data.status,
                "effective_date": version_data.effective_date,
                "change_type": version_data.change_type,
                "metadata": version_data.metadata,
                "created_by": user_id
            }
            
            result = await db.fetch_one(query, params)
            version_id = result['id']
            
            self.created_ids['program_version'].append(version_id)
            self.counts['program_version'] += 1
            
            logger.info(f"Created program version: {version_number} (ID: {version_id})")
            return version_id
            
        except Exception as e:
            logger.error(f"Error creating program version: {e}")
            raise
    
    async def _create_program_objectives(self, objectives: List[ProgramObjectiveImportData], version_id: int, user_id: int):
        """Create program objective records"""
        for obj_data in objectives:
            try:
                query = """
                    INSERT INTO program_objective (
                        version_id, code, description, display_order, metadata, created_by
                    ) VALUES (
                        :version_id, :code, :description, :display_order, :metadata::jsonb, :created_by
                    ) RETURNING id
                """
                
                params = {
                    "version_id": version_id,
                    "code": obj_data.code,
                    "description": obj_data.description,
                    "display_order": obj_data.display_order,
                    "metadata": obj_data.metadata,
                    "created_by": user_id
                }
                
                result = await db.fetch_one(query, params)
                self.created_ids['program_objective'].append(result['id'])
                self.counts['program_objective'] += 1
                self.po_code_to_id[obj_data.code.upper()] = result['id']
                
            except Exception as e:
                logger.error(f"Error creating program objective {obj_data.code}: {e}")
                raise
    
    async def _create_learning_outcomes(self, outcomes: List[LearningOutcomeImportData], version_id: int, user_id: int):
        """Create learning outcome records"""
        for outcome_data in outcomes:
            try:
                query = """
                    INSERT INTO learning_outcome (
                        version_id, code, description, competency_level, display_order, metadata, created_by
                    ) VALUES (
                        :version_id, :code, :description, :competency_level, :display_order, :metadata::jsonb, :created_by
                    ) RETURNING id
                """
                
                params = {
                    "version_id": version_id,
                    "code": outcome_data.code,
                    "description": outcome_data.description,
                    "competency_level": outcome_data.competency_level,
                    "display_order": outcome_data.display_order,
                    "metadata": outcome_data.metadata,
                    "created_by": user_id
                }
                
                result = await db.fetch_one(query, params)
                self.created_ids['learning_outcome'].append(result['id'])
                self.counts['learning_outcome'] += 1
                self.plo_code_to_id[outcome_data.code.upper()] = result['id']
                
            except Exception as e:
                logger.error(f"Error creating learning outcome {outcome_data.code}: {e}")
                raise
    
    async def _create_plo_po_mapping(self, mappings: List[PLOPOMapImportData], version_id: int, user_id: int):
        """Create PLO-PO mapping records"""
        processed_pairs: Set[Tuple[str, str]] = set()
        for mapping_data in mappings:
            pair_key = (mapping_data.plo_code.upper(), mapping_data.po_code.upper())
            if pair_key in processed_pairs:
                logger.info(
                    "Skipping duplicate PLO-PO mapping %s -> %s",
                    mapping_data.plo_code,
                    mapping_data.po_code
                )
                continue
            processed_pairs.add(pair_key)
            try:
                plo_id = self.plo_code_to_id.get(mapping_data.plo_code.upper())
                if not plo_id:
                    plo_result = await db.fetch_one(
                        """
                        SELECT lo.id FROM learning_outcome lo
                        WHERE lo.code = :plo_code
                          AND lo.version_id = :version_id
                          AND lo.deleted_at IS NULL
                        """,
                        {"plo_code": mapping_data.plo_code, "version_id": version_id}
                    )
                    plo_id = plo_result['id'] if plo_result else None
                po_id = self.po_code_to_id.get(mapping_data.po_code.upper())
                if not po_id:
                    po_result = await db.fetch_one(
                        """
                        SELECT po.id FROM program_objective po
                        WHERE po.code = :po_code
                          AND po.version_id = :version_id
                          AND po.deleted_at IS NULL
                        """,
                        {"po_code": mapping_data.po_code, "version_id": version_id}
                    )
                    po_id = po_result['id'] if po_result else None

                if not plo_id or not po_id:
                    raise Exception(f"Không tìm thấy liên kết PLO - PO: {mapping_data.plo_code} -> {mapping_data.po_code}")
                
                query = """
                    INSERT INTO plo_po_map (
                        plo_id, po_id, mapping_strength, metadata, created_by
                    ) VALUES (
                        :plo_id, :po_id, :mapping_strength, :metadata::jsonb, :created_by
                    )
                """
                
                params = {
                    "plo_id": plo_id,
                    "po_id": po_id,
                    "mapping_strength": mapping_data.mapping_strength,
                    "metadata": mapping_data.metadata,
                    "created_by": user_id
                }
                
                await db.execute(query, params)
                self.counts['plo_po_map'] += 1
                
            except Exception as e:
                logger.error(f"Error creating PLO-PO mapping {mapping_data.plo_code}->{mapping_data.po_code}: {e}")
                raise
    
    async def _create_admission_criteria(self, criteria_data: AdmissionCriteriaImportData, version_id: int, user_id: int):
        """Create admission criteria record"""
        try:
            payload = {
                "target_group": criteria_data.target_group,
                "selection_criteria": criteria_data.selection_criteria,
            }
            if criteria_data.metadata:
                payload["metadata"] = criteria_data.metadata

            query = """
                UPDATE program_version
                SET admission_criteria = jsonb_strip_nulls(COALESCE(CAST(:payload AS jsonb), '{}'::jsonb)),
                    updated_at = CURRENT_TIMESTAMP,
                    updated_by = :created_by
                WHERE id = :version_id
                RETURNING id
            """

            params = {
                "version_id": version_id,
                "payload": json.dumps(payload),
                "created_by": user_id,
            }

            result = await db.fetch_one(query, params)
            if not result:
                raise Exception(f"Không tìm thấy phiên bản chương trình {version_id} để cập nhật tiêu chí tuyển sinh.")

            self.created_ids['admission_criteria'].append(result['id'])
            self.counts['admission_criteria'] += 1

        except Exception as e:
            logger.error(f"Error creating admission criteria: {e}")
            raise
    
    async def _create_knowledge_structure(self, blocks: List[KnowledgeBlockImportData], groups: List[CourseGroupImportData], version_id: int, user_id: int):
        """Create knowledge blocks and course groups"""
        # First, create knowledge blocks and track their IDs
        block_id_map: Dict[str, int] = {}
        
        for block_data in blocks:
            try:
                block_key = self._normalize_structure_name(block_data.name)
                if self._is_invalid_block_key(block_key):
                    self.invalid_block_keys.add(block_key)
                    logger.info("Skipping invalid knowledge block name: %s", block_data.name)
                    continue
                if block_key in block_id_map:
                    logger.info("Skipping duplicate knowledge block: %s", block_data.name)
                    continue

                # Find parent block ID if specified
                parent_block_id = None
                if block_data.parent_block_name:
                    parent_key = self._normalize_structure_name(block_data.parent_block_name)
                    if self._is_invalid_block_key(parent_key):
                        logger.info(
                            "Skipping knowledge block %s because parent %s is invalid",
                            block_data.name,
                            block_data.parent_block_name,
                        )
                        self.invalid_block_keys.add(block_key)
                        continue
                    parent_block_id = block_id_map.get(parent_key)
                    if not parent_block_id:
                        raise Exception(f"Không tìm thấy khối kiến thức cha: {block_data.parent_block_name}")
                
                query = """
                    INSERT INTO knowledge_block (
                        version_id, name, block_type, parent_block_id, display_order, description, metadata, created_by
                    ) VALUES (
                        :version_id, :name, :block_type, :parent_block_id, :display_order, :description, :metadata::jsonb, :created_by
                    ) RETURNING id
                """
                
                params = {
                    "version_id": version_id,
                    "name": block_data.name,
                    "block_type": block_data.block_type,
                    "parent_block_id": parent_block_id,
                    "display_order": block_data.display_order,
                    "description": block_data.description,
                    "metadata": block_data.metadata,
                    "created_by": user_id
                }
                
                result = await db.fetch_one(query, params)
                block_id = result['id']
                block_id_map[block_key] = block_id
                self.block_name_to_id[block_key] = block_id
                
                self.created_ids['knowledge_block'].append(block_id)
                self.counts['knowledge_block'] += 1
                
            except Exception as e:
                logger.error(f"Error creating knowledge block {block_data.name}: {e}")
                raise
        
        # Then, create course groups
        for group_data in groups:
            try:
                group_key = self._normalize_structure_name(group_data.name)
                if self._is_invalid_group_key(group_key):
                    self.invalid_group_keys.add(group_key)
                    logger.info("Skipping invalid course group name: %s", group_data.name)
                    continue
                # Find knowledge block ID if specified
                knowledge_block_id = None
                if group_data.block_name:
                    block_key = self._normalize_structure_name(group_data.block_name)
                    if self._is_invalid_block_key(block_key):
                        logger.info(
                            "Skipping course group %s because knowledge block %s is invalid",
                            group_data.name,
                            group_data.block_name,
                        )
                        self.invalid_group_keys.add(group_key)
                        continue
                    knowledge_block_id = block_id_map.get(block_key)
                    if not knowledge_block_id:
                        raise Exception(f"Không tìm thấy khối kiến thức: {group_data.block_name}")
                
                query = """
                    INSERT INTO course_group (
                        version_id, knowledge_block_id, name, group_type, display_order,
                        min_credits_required, max_credits_allowed, description, metadata, created_by
                    ) VALUES (
                        :version_id, :knowledge_block_id, :name, :group_type, :display_order,
                        :min_credits_required, :max_credits_allowed, :description, :metadata::jsonb, :created_by
                    ) RETURNING id
                """
                
                params = {
                    "version_id": version_id,
                    "knowledge_block_id": knowledge_block_id,
                    "name": group_data.name,
                    "group_type": group_data.group_type,
                    "display_order": group_data.display_order,
                    "min_credits_required": group_data.min_credits_required,
                    "max_credits_allowed": group_data.max_credits_allowed,
                    "description": group_data.description,
                    "metadata": group_data.metadata,
                    "created_by": user_id
                }
                
                result = await db.fetch_one(query, params)
                group_id = result['id']
                self.created_ids['course_group'].append(group_id)
                self.counts['course_group'] += 1
                self.group_name_to_id[group_key] = group_id
                
            except Exception as e:
                logger.error(f"Error creating course group {group_data.name}: {e}")
                raise
    
    async def _create_courses(self, courses: List[CourseImportData], user_id: int):
        """Validate and register existing course records (no creation from import)"""
        for course_data in courses:
            try:
                # Fetch course from database (must exist after validation)
                course_details = await self._get_course_details(course_data.code)

                if not course_details:
                    raise Exception(f"Học phần '{course_data.code}' không tồn tại trong cơ sở dữ liệu.")

                course_id = course_details['id']
                self.course_code_to_id[course_data.code.upper()] = course_id

                # Log that we're using the existing course with database details
                logger.info(
                    f"Using existing course: {course_data.code} (ID: {course_id}) - "
                    f"Credits: {course_details['default_total_credits']} "
                    f"(Lecture: {course_details['default_lecture_credits']}, "
                    f"Practical: {course_details['default_practical_credits']}, "
                    f"Project: {course_details['default_project_credits']}, "
                    f"Internship: {course_details['default_internship_credits']})"
                )

            except Exception as e:
                logger.error(f"Error validating course {course_data.code}: {e}")
                raise
    
    async def _create_course_placements(self, placements: List[ProgramCoursePlacementImportData], version_id: int, user_id: int):
        """Create program course placement records"""
        for placement_data in placements:
            try:
                course_id = await self._get_course_id(placement_data.course_code)
                if not course_id:
                    raise Exception(f"Không tìm thấy học phần: {placement_data.course_code}")

                block_key = self._normalize_structure_name(placement_data.block_name)
                group_key = self._normalize_structure_name(placement_data.group_name)

                if block_key and self._is_invalid_block_key(block_key):
                    logger.info(
                        "Skipping course placement for %s due to invalid knowledge block: %s",
                        placement_data.course_code,
                        placement_data.block_name,
                    )
                    self.invalid_block_keys.add(block_key)
                    continue

                if group_key and self._is_invalid_group_key(group_key):
                    logger.info(
                        "Skipping course placement for %s due to invalid course group: %s",
                        placement_data.course_code,
                        placement_data.group_name,
                    )
                    self.invalid_group_keys.add(group_key)
                    continue

                course_group_id = await self._get_course_group_id(placement_data.group_name, version_id)
                if placement_data.group_name and not course_group_id:
                    if group_key:
                        logger.info(
                            "Skipping course placement for %s due to unknown course group: %s",
                            placement_data.course_code,
                            placement_data.group_name,
                        )
                        self.invalid_group_keys.add(group_key)
                    continue

                knowledge_block_id = None
                if not course_group_id:
                    knowledge_block_id = await self._get_knowledge_block_id(placement_data.block_name, version_id)
                    if placement_data.block_name and not knowledge_block_id:
                        raise Exception(f"Không tìm thấy khối kiến thức: {placement_data.block_name}")
                placement_key = (course_id, course_group_id, knowledge_block_id)
                if placement_key in self.processed_placement_keys:
                    logger.info(
                        "Skipping duplicate course placement for %s (group_id=%s, block_id=%s)",
                        placement_data.course_code,
                        course_group_id,
                        knowledge_block_id,
                    )
                    continue

                # Skip prerequisite and corequisite processing - these will be left blank
                # as per requirement: only insert course credit data from database

                display_order = placement_data.display_order or (self.counts['program_course_placement'] + 1)

                # Fetch course details from database to ensure we use verified course data
                course_details = await self._get_course_details(placement_data.course_code)
                if not course_details:
                    raise Exception(
                        f"Không thể lấy thông tin học phần từ cơ sở dữ liệu: {placement_data.course_code}. "
                        f"Vui lòng đảm bảo học phần đã được thêm vào hệ thống."
                    )

                # Use course credits from database, not from DOCX
                total_credits = course_details.get('default_total_credits', 0)
                lecture_credits = course_details.get('default_lecture_credits', 0)
                practical_credits = course_details.get('default_practical_credits', 0)
                project_credits = course_details.get('default_project_credits', 0)
                internship_credits = course_details.get('default_internship_credits', 0)

                logger.info(
                    f"Creating placement for course {placement_data.course_code} with database credits: "
                    f"Total={total_credits}, Lecture={lecture_credits}, Practical={practical_credits}, "
                    f"Project={project_credits}, Internship={internship_credits}"
                )

                query = """
                    INSERT INTO program_course_placement (
                        version_id, course_id, course_group_id, knowledge_block_id,
                        total_credits, lecture_credits, practical_credits, project_credits, internship_credits,
                        semester_recommended, year_recommended, is_mandatory, note, display_order,
                        metadata, created_by
                    ) VALUES (
                        :version_id, :course_id, :course_group_id, :knowledge_block_id,
                        :total_credits, :lecture_credits, :practical_credits, :project_credits, :internship_credits,
                        :semester_recommended, :year_recommended, :is_mandatory, :note, :display_order,
                        :metadata::jsonb, :created_by
                    ) RETURNING id
                """

                params = {
                    "version_id": version_id,
                    "course_id": course_id,
                    "course_group_id": course_group_id,
                    "knowledge_block_id": knowledge_block_id,
                    "total_credits": total_credits,
                    "lecture_credits": lecture_credits,
                    "practical_credits": practical_credits,
                    "project_credits": project_credits,
                    "internship_credits": internship_credits,
                    # prereq_course_ids and coreq_course_ids left blank (NULL)
                    "semester_recommended": placement_data.semester_recommended,
                    "year_recommended": placement_data.year_recommended,
                    "is_mandatory": placement_data.is_mandatory,
                    "note": placement_data.note,
                    "display_order": display_order,
                    "metadata": placement_data.metadata,
                    "created_by": user_id
                }
                
                result = await db.fetch_one(query, params)
                placement_id = result['id']
                self.processed_placement_keys.add(placement_key)
                self.created_ids['program_course_placement'].append(placement_id)
                self.counts['program_course_placement'] += 1
                self.placement_course_map.setdefault(placement_data.course_code.upper(), []).append(placement_id)
                
            except Exception as e:
                logger.error(f"Error creating course placement for {placement_data.course_code}: {e}")
                raise
    
    async def _create_course_plo_contributions(self, contributions: List[CoursePLOContributionImportData], version_id: int, user_id: int):
        """Create course-PLO contribution records"""
        processed_pairs: Set[Tuple[str, str, str]] = set()
        for contribution_data in contributions:
            normalized_indicator = normalize_performance_indicator_value(
                contribution_data.plo_code,
                contribution_data.performance_indicator,
                contribution_data.contribution_level,
            )
            contribution_data.performance_indicator = normalized_indicator
            pair_key = (
                contribution_data.course_code.upper(),
                contribution_data.plo_code.upper(),
                normalized_indicator,
            )
            if pair_key in processed_pairs:
                logger.info(
                    "Skipping duplicate course-PLO contribution %s -> %s (%s)",
                    contribution_data.course_code,
                    contribution_data.plo_code,
                    contribution_data.performance_indicator,
                )
                continue
            processed_pairs.add(pair_key)
            try:
                placement_candidates = self.placement_course_map.get(contribution_data.course_code.upper(), [])
                placement_id = placement_candidates[0] if placement_candidates else None
                if not placement_id:
                    placement_row = await db.fetch_one(
                        """
                        SELECT pcp.id
                        FROM program_course_placement pcp
                        JOIN course c ON pcp.course_id = c.id
                        WHERE c.code = :course_code
                          AND pcp.version_id = :version_id
                          AND pcp.deleted_at IS NULL
                        """,
                        {"course_code": contribution_data.course_code, "version_id": version_id}
                    )
                    placement_id = placement_row["id"] if placement_row else None

                if not placement_id:
                    raise Exception(f"Không tìm thấy phân bổ cho học phần: {contribution_data.course_code}")

                plo_id = self.plo_code_to_id.get(contribution_data.plo_code.upper())
                if not plo_id:
                    plo_row = await db.fetch_one(
                        """
                        SELECT lo.id FROM learning_outcome lo
                        WHERE lo.code = :plo_code
                          AND lo.version_id = :version_id
                          AND lo.deleted_at IS NULL
                        """,
                        {"plo_code": contribution_data.plo_code, "version_id": version_id}
                    )
                    plo_id = plo_row["id"] if plo_row else None

                if not plo_id:
                    raise Exception(f"Không tìm thấy PLO: {contribution_data.plo_code}")

                query = """
                    INSERT INTO course_plo_contribution (
                        placement_id, plo_id, contribution_level, performance_indicator, note, metadata, created_by
                    ) VALUES (
                        :placement_id, :plo_id, :contribution_level, :performance_indicator, :note, :metadata::jsonb, :created_by
                    ) RETURNING id
                """
                
                params = {
                    "placement_id": placement_id,
                    "plo_id": plo_id,
                    "contribution_level": contribution_data.contribution_level,
                    "performance_indicator": normalized_indicator,
                    "note": contribution_data.note,
                    "metadata": contribution_data.metadata,
                    "created_by": user_id
                }
                
                result = await db.fetch_one(query, params)
                self.created_ids['course_plo_contribution'].append(result['id'])
                self.counts['course_plo_contribution'] += 1
                
            except Exception as e:
                logger.error(f"Error creating course-PLO contribution for {contribution_data.course_code}->{contribution_data.plo_code}: {e}")
                raise


async def import_curriculum_data(data: CurriculumImportData, user_id: int) -> Tuple[bool, Dict[str, List[int]], Dict[str, int], List[str], Optional[str]]:
    """Import curriculum data using service layer"""
    service = DocxImportService()
    return await service.import_curriculum_data(data, user_id)
