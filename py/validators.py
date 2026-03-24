"""Validation logic for DOCX import data"""
import logging
from typing import Dict, List, Tuple, Optional, Set
from datetime import datetime

from app.db import db
from .schemas import (
    CurriculumImportData,
    ProgramImportData,
    ProgramVersionImportData,
    ProgramObjectiveImportData,
    LearningOutcomeImportData,
    PLOPOMapImportData,
    CourseImportData,
    ProgramCoursePlacementImportData,
    CoursePLOContributionImportData,
    KnowledgeBlockImportData,
    CourseGroupImportData
)

logger = logging.getLogger(__name__)


class DocxImportValidator:
    """Validator for curriculum import data"""
    
    def __init__(self):
        self.warnings: List[str] = []
        self.blocking_errors: List[str] = []
        self.validation_summary: Dict[str, any] = {}
        
        # Cache for database lookups
        self.existing_programs = set()
        self.existing_faculties = {}
        self.existing_courses = set()
        self.program_versions = set()
    
    async def validate(self, data: CurriculumImportData) -> Tuple[bool, List[str], List[str], Dict[str, any]]:
        """Validate import data and return (ok, warnings, blocking_errors, summary)"""
        await self._preload_reference_data()
        
        # Validate program
        await self._validate_program(data.program)
        
        # Validate program version
        await self._validate_program_version(data.program_version, data.program.code)
        
        # Validate program objectives
        self._validate_program_objectives(data.program_objectives)
        
        # Validate learning outcomes
        self._validate_learning_outcomes(data.learning_outcomes)
        
        # Validate PLO-PO mapping
        self._validate_plo_po_mapping(data.plo_po_map, data.program_objectives, data.learning_outcomes)
        
        # Validate knowledge structure
        await self._validate_knowledge_structure(
            data.knowledge_blocks, 
            data.course_groups
        )
        
        # Validate courses
        await self._validate_courses(data.courses)
        
        # Validate course placements
        self._validate_course_placements(
            data.program_course_placement,
            data.courses,
            data.course_groups,
            data.knowledge_blocks
        )
        
        # Validate course-PLO contributions
        self._validate_course_plo_contributions(
            data.course_plo_contribution,
            data.courses,
            data.learning_outcomes
        )
        
        # Build validation summary
        self._build_validation_summary(data)
        
        is_valid = len(self.blocking_errors) == 0
        return is_valid, self.warnings, self.blocking_errors, self.validation_summary
    
    async def _preload_reference_data(self):
        """Preload reference data from database"""
        try:
            # Load existing programs
            programs = await db.fetch_all("SELECT code FROM program WHERE deleted_at IS NULL")
            self.existing_programs = {row['code'] for row in programs}
            
            # Load existing faculties
            faculties = await db.fetch_all("SELECT id, code, name FROM faculty WHERE deleted_at IS NULL")
            self.existing_faculties = {
                row['name'].lower(): row['id'] for row in faculties
            }
            
            # Load existing courses
            courses = await db.fetch_all("SELECT code FROM course WHERE deleted_at IS NULL")
            self.existing_courses = {row['code'] for row in courses}
            
            # Load program versions
            versions = await db.fetch_all("""
                SELECT pv.version_number, p.code as program_code 
                FROM program_version pv 
                JOIN program p ON pv.program_id = p.id 
                WHERE pv.deleted_at IS NULL AND p.deleted_at IS NULL
            """)
            self.program_versions = {
                f"{row['program_code']}:{row['version_number']}" 
                for row in versions
            }
            
        except Exception as e:
            logger.error(f"Lỗi tải dữ liệu tham chiếu: {e}")
            self.blocking_errors.append("Không thể tải dữ liệu tham chiếu từ cơ sở dữ liệu.")
    
    async def _validate_program(self, program: ProgramImportData):
        """Validate program data"""
        # Check if program code already exists
        if program.code.lower() in (p.lower() for p in self.existing_programs):
            self.blocking_errors.append(f"Chương trình với mã '{program.code}' đã tồn tại trong hệ thống.")
        
        # Check if faculty exists
        faculty_id = self.existing_faculties.get(program.faculty_name.lower())
        if not faculty_id:
            self.blocking_errors.append(f"Không tìm thấy khoa/đơn vị '{program.faculty_name}' trong hệ thống.")
        
        # Validate program code format
        if not program.code or len(program.code) < 3:
            self.blocking_errors.append("Mã chương trình phải có tối thiểu 3 ký tự.")
        
        # Validate names
        if not program.vn_name or not program.en_name:
            self.blocking_errors.append("Cần cung cấp đủ tên chương trình bằng tiếng Việt và tiếng Anh.")
    
    async def _validate_program_version(self, version: ProgramVersionImportData, program_code: str):
        """Validate program version data"""
        # Check if version already exists for this program
        version_key = f"{program_code}:{version.version_number}"
        if version_key in self.program_versions:
            self.blocking_errors.append(
                f"Phiên bản '{version.version_number}' đã tồn tại cho chương trình '{program_code}'."
            )
        
        # Validate version number format
        if not version.version_number:
            self.blocking_errors.append("Cần cung cấp mã phiên bản.")
        
        # Validate status
        valid_statuses = ['draft', 'submitted', 'pending_approval', 'approved', 'active', 'archived']
        if version.status not in valid_statuses:
            self.blocking_errors.append(f"Trạng thái phiên bản không hợp lệ: {version.status}")
    
    def _validate_program_objectives(self, objectives: List[ProgramObjectiveImportData]):
        """Validate program objectives"""
        if not objectives:
            self.warnings.append("Không tìm thấy mục tiêu chương trình (PO).")
            return
        
        # Check for duplicate codes
        codes = [obj.code for obj in objectives]
        duplicates = self._find_duplicates(codes)
        if duplicates:
            self.blocking_errors.append(f"Trùng mã mục tiêu chương trình: {', '.join(duplicates)}")
        
        # Validate code format
        for obj in objectives:
            if not obj.code or not obj.code.startswith('PO'):
                self.blocking_errors.append(f"Mã mục tiêu chương trình không hợp lệ: {obj.code}. Mã phải bắt đầu bằng 'PO'.")
    
    def _validate_learning_outcomes(self, outcomes: List[LearningOutcomeImportData]):
        """Validate learning outcomes"""
        if not outcomes:
            self.warnings.append("Không tìm thấy chuẩn đầu ra (PLO).")
            return
        
        # Check for duplicate codes
        codes = [outcome.code for outcome in outcomes]
        duplicates = self._find_duplicates(codes)
        if duplicates:
            self.blocking_errors.append(f"Trùng mã chuẩn đầu ra: {', '.join(duplicates)}")
        
        # Validate code format
        for outcome in outcomes:
            if not outcome.code or not outcome.code.startswith('PLO'):
                self.blocking_errors.append(f"Mã chuẩn đầu ra không hợp lệ: {outcome.code}. Mã phải bắt đầu bằng 'PLO'.")
            
            # Validate competency level
            if outcome.competency_level is not None:
                if not (0.0 <= outcome.competency_level <= 5.0):
                    self.blocking_errors.append(
                        f"Mức năng lực của {outcome.code} không hợp lệ: {outcome.competency_level}. Giá trị phải nằm trong khoảng 0.0 đến 5.0."
                    )
    
    def _validate_plo_po_mapping(
        self, 
        mappings: List[PLOPOMapImportData], 
        objectives: List[ProgramObjectiveImportData],
        outcomes: List[LearningOutcomeImportData]
    ):
        """Validate PLO-PO mapping"""
        if not mappings:
            self.warnings.append("Không tìm thấy ma trận liên kết PO - PLO.")
            return
        
        # Get valid codes
        valid_po_codes = {obj.code for obj in objectives}
        valid_plo_codes = {outcome.code for outcome in outcomes}
        
        for mapping in mappings:
            # Check if PO exists
            if mapping.po_code not in valid_po_codes:
                self.blocking_errors.append(
                    f"Liên kết PLO - PO tham chiếu tới PO không tồn tại: {mapping.po_code}"
                )
            
            # Check if PLO exists
            if mapping.plo_code not in valid_plo_codes:
                self.blocking_errors.append(
                    f"Liên kết PLO - PO tham chiếu tới PLO không tồn tại: {mapping.plo_code}"
                )
        
        # Duplicate PLO-PO mappings are allowed to proceed for confirmation/import stages.
    
    async def _validate_knowledge_structure(
        self,
        blocks: List[KnowledgeBlockImportData],
        groups: List[CourseGroupImportData]
    ):
        """Validate knowledge structure"""
        # Validate blocks
        block_names = [block.name for block in blocks]
        block_duplicates = self._find_duplicates(block_names)
        if block_duplicates:
            self.blocking_errors.append(f"Trùng tên khối kiến thức: {', '.join(block_duplicates)}")
        
        # Check parent block references
        block_name_set = set(block_names)
        for block in blocks:
            if block.parent_block_name and block.parent_block_name not in block_name_set:
                self.blocking_errors.append(
                    f"Khối kiến thức '{block.name}' tham chiếu khối cha không tồn tại: {block.parent_block_name}"
                )
        
        # Validate groups
        group_names = [group.name for group in groups]
        group_duplicates = self._find_duplicates(group_names)
        if group_duplicates:
            self.blocking_errors.append(f"Trùng tên nhóm học phần: {', '.join(group_duplicates)}")
        
        # Check block references in groups
        for group in groups:
            if group.block_name and group.block_name not in block_name_set:
                self.blocking_errors.append(
                    f"Nhóm học phần '{group.name}' tham chiếu khối kiến thức không tồn tại: {group.block_name}"
                )
    
    async def _validate_courses(self, courses: List[CourseImportData]):
        """Validate courses"""
        if not courses:
            self.warnings.append("Không tìm thấy danh sách học phần.")
            return

        # Check for duplicate codes
        codes = [course.code for course in courses]
        duplicates = self._find_duplicates(codes)
        if duplicates:
            self.blocking_errors.append(f"Trùng mã học phần: {', '.join(duplicates)}")

        # Check if all courses exist in database
        missing_courses = []
        for course in courses:
            if course.code not in self.existing_courses:
                missing_courses.append(course.code)

        if missing_courses:
            if len(missing_courses) == 1:
                self.blocking_errors.append(
                    f"Học phần '{missing_courses[0]}' không tồn tại trong cơ sở dữ liệu. Vui lòng thêm học phần trước khi nhập chương trình."
                )
            else:
                courses_str = ", ".join(missing_courses)
                self.blocking_errors.append(
                    f"Các học phần sau không tồn tại trong cơ sở dữ liệu: {courses_str}. Vui lòng thêm các học phần này trước khi nhập chương trình."
                )

        # Validate course data
        for course in courses:
            if not course.name:
                self.blocking_errors.append(f"Học phần '{course.code}' chưa có tên.")

            # Validate credits
            total_credits = (
                course.default_lecture_credits +
                course.default_practical_credits +
                course.default_project_credits +
                course.default_internship_credits
            )

            if course.default_total_credits > 0 and total_credits > course.default_total_credits:
                self.warnings.append(
                    f"Học phần '{course.code}': Tổng tín chỉ thành phần ({total_credits}) vượt quá tổng tín chỉ khai báo ({course.default_total_credits})."
                )
    
    def _validate_course_placements(
        self,
        placements: List[ProgramCoursePlacementImportData],
        courses: List[CourseImportData],
        groups: List[CourseGroupImportData],
        blocks: List[KnowledgeBlockImportData]
    ):
        """Validate course placements"""
        if not placements:
            self.warnings.append("Không tìm thấy cấu hình phân bổ học phần.")
            return
        
        # Get valid references
        valid_courses = {course.code for course in courses}
        valid_groups = {group.name for group in groups}
        valid_blocks = {block.name for block in blocks}
        
        for placement in placements:
            # Check course exists
            if placement.course_code not in valid_courses:
                self.blocking_errors.append(
                    f"Phân bổ học phần tham chiếu tới mã học phần không tồn tại: {placement.course_code}"
                )
            
            # Check location (group or block)
            if placement.group_name:
                if placement.group_name not in valid_groups:
                    self.blocking_errors.append(
                        f"Phân bổ học phần tham chiếu nhóm học phần không tồn tại: {placement.group_name}"
                    )
            elif placement.block_name:
                if placement.block_name not in valid_blocks:
                    self.blocking_errors.append(
                        f"Phân bổ học phần tham chiếu khối kiến thức không tồn tại: {placement.block_name}"
                    )
            else:
                self.blocking_errors.append(
                    f"Phân bổ của học phần '{placement.course_code}' phải chỉ rõ nhóm hoặc khối kiến thức."
                )
            
            # Validate prerequisites
            for prereq_code in placement.prereq_course_codes:
                if prereq_code not in valid_courses:
                    self.blocking_errors.append(
                        f"Học phần '{placement.course_code}' có điều kiện tiên quyết không tồn tại: {prereq_code}"
                    )
            
            # Validate corequisites
            for coreq_code in placement.coreq_course_codes:
                if coreq_code not in valid_courses:
                    self.blocking_errors.append(
                        f"Học phần '{placement.course_code}' có học phần học song hành không tồn tại: {coreq_code}"
                    )
            
            # Validate semester and year
            if placement.semester_recommended and not (1 <= placement.semester_recommended <= 12):
                self.blocking_errors.append(
                    f"Học kỳ gợi ý của học phần '{placement.course_code}' không hợp lệ: {placement.semester_recommended}"
                )
            
            if placement.year_recommended and not (1 <= placement.year_recommended <= 6):
                self.blocking_errors.append(
                    f"Năm học gợi ý của học phần '{placement.course_code}' không hợp lệ: {placement.year_recommended}"
                )
    
    def _validate_course_plo_contributions(
        self,
        contributions: List[CoursePLOContributionImportData],
        courses: List[CourseImportData],
        outcomes: List[LearningOutcomeImportData]
    ):
        """Validate course-PLO contributions"""
        if not contributions:
            self.warnings.append("Không tìm thấy ma trận đóng góp học phần - PLO.")
            return
        
        # Get valid references
        valid_courses = {course.code for course in courses}
        valid_plos = {outcome.code for outcome in outcomes}
        
        # Duplicate course-PLO contribution rows are allowed; skip blocking validation.
        
        for contribution in contributions:
            # Check course exists
            if contribution.course_code not in valid_courses:
                self.blocking_errors.append(
                    f"Dữ liệu đóng góp tham chiếu tới học phần không tồn tại: {contribution.course_code}"
                )
            
            # Check PLO exists
            if contribution.plo_code not in valid_plos:
                self.blocking_errors.append(
                    f"Dữ liệu đóng góp tham chiếu tới PLO không tồn tại: {contribution.plo_code}"
                )
            
            # Validate contribution level
            if not (1 <= contribution.contribution_level <= 5):
                self.blocking_errors.append(
                    f"Mức đóng góp của cặp {contribution.course_code}-{contribution.plo_code} không hợp lệ: "
                    f"{contribution.contribution_level}. Giá trị phải nằm trong khoảng 1 đến 5."
                )
    
    def _find_duplicates(self, items: List[str]) -> List[str]:
        """Find duplicate items in a list"""
        seen = set()
        duplicates = set()
        for item in items:
            if item in seen:
                duplicates.add(item)
            else:
                seen.add(item)
        return list(duplicates)
    
    def _build_validation_summary(self, data: CurriculumImportData):
        """Build validation summary"""
        self.validation_summary = {
            'program': {
                'code': data.program.code,
                'name': data.program.vn_name,
                'faculty': data.program.faculty_name
            },
            'version': data.program_version.version_number,
            'counts': {
                'program_objectives': len(data.program_objectives),
                'learning_outcomes': len(data.learning_outcomes),
                'plo_po_mappings': len(data.plo_po_map),
                'knowledge_blocks': len(data.knowledge_blocks),
                'course_groups': len(data.course_groups),
                'courses': len(data.courses),
                'course_placements': len(data.program_course_placement),
                'course_plo_contributions': len(data.course_plo_contribution)
            },
            'validation': {
                'blocking_errors': len(self.blocking_errors),
                'warnings': len(self.warnings),
                'is_valid': len(self.blocking_errors) == 0
            }
        }


async def validate_import_data(data: CurriculumImportData) -> Tuple[bool, List[str], List[str], Dict[str, any]]:
    """Validate import data and return results"""
    validator = DocxImportValidator()
    return await validator.validate(data)
