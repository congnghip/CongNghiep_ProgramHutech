"""Pydantic schemas for DOCX import functionality"""
from datetime import datetime, date
from typing import List, Dict, Optional, Any, Union
from enum import Enum
from pydantic import BaseModel, Field, model_validator


class ImportSource(str, Enum):
    """Import source types"""
    PATH = "path"
    UPLOAD = "upload"


class MappingStrength(str, Enum):
    """PLO-PO mapping strength levels"""
    WEAK = "weak"
    MODERATE = "moderate"
    STRONG = "strong"


class BlockType(str, Enum):
    """Knowledge block types"""
    GENERAL = "general"
    CORE = "core"
    SPECIALIZED = "specialized"
    ELECTIVE = "elective"
    FOUNDATION = "foundation"


class GroupType(str, Enum):
    """Course group types"""
    MANDATORY = "mandatory"
    ELECTIVE = "elective"
    CAPSTONE = "capstone"


# Base schemas for import data
class ProgramImportData(BaseModel):
    """Program data for import"""
    code: str = Field(..., min_length=3, max_length=50, description="Program code")
    vn_name: str = Field(..., min_length=1, max_length=255, description="Vietnamese name")
    en_name: str = Field(..., min_length=1, max_length=255, description="English name")
    faculty_name: str = Field(..., description="Faculty name (must exist)")
    awarding_institution: Optional[str] = Field(None, max_length=255)
    degree_title: Optional[str] = Field(None, max_length=255)
    degree_level: Optional[str] = Field(None, max_length=100)
    study_mode: Optional[str] = Field(None, max_length=100)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ProgramVersionImportData(BaseModel):
    """Program version data for import"""
    version_number: str = Field(..., min_length=1, max_length=50)
    version_name: Optional[str] = Field(None, max_length=255)
    total_credits: Optional[str] = Field(None, max_length=50)
    duration: Optional[str] = Field(None, max_length=50)
    effective_date: Optional[date] = None
    status: str = Field(default="draft", pattern="^(draft|submitted|pending_approval|approved|active|archived)$")
    change_type: Optional[str] = Field(None, pattern="^(major|minor|patch)$")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ProgramObjectiveImportData(BaseModel):
    """Program objective data for import"""
    code: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None
    display_order: int = Field(default=0, ge=0)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class LearningOutcomeImportData(BaseModel):
    """Learning outcome data for import"""
    code: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None
    competency_level: Optional[float] = Field(None, ge=0.0, le=5.0)
    display_order: int = Field(default=0, ge=0)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class PLOPOMapImportData(BaseModel):
    """PLO-PO mapping data for import"""
    plo_code: str = Field(..., description="PLO code")
    po_code: str = Field(..., description="PO code")
    mapping_strength: MappingStrength = Field(default=MappingStrength.STRONG)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AdmissionCriteriaImportData(BaseModel):
    """Admission criteria data for import"""
    target_group: str = Field(..., description="Target student group")
    selection_criteria: str = Field(..., description="Selection criteria")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class KnowledgeBlockImportData(BaseModel):
    """Knowledge block data for import"""
    name: str = Field(..., min_length=1, max_length=255)
    block_type: Optional[BlockType] = None
    parent_block_name: Optional[str] = Field(None, description="Parent block name for hierarchy")
    display_order: int = Field(default=0, ge=0)
    description: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class CourseGroupImportData(BaseModel):
    """Course group data for import"""
    name: str = Field(..., min_length=1, max_length=255)
    block_name: Optional[str] = Field(None, description="Parent knowledge block name")
    group_type: Optional[GroupType] = None
    display_order: int = Field(default=0, ge=0)
    min_credits_required: int = Field(default=0, ge=0)
    max_credits_allowed: Optional[int] = Field(None, ge=0)
    description: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class CourseImportData(BaseModel):
    """Course data for import"""
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=255)
    en_name: Optional[str] = Field(None, max_length=255)
    default_total_credits: int = Field(default=0, ge=0)
    default_lecture_credits: int = Field(default=0, ge=0)
    default_practical_credits: int = Field(default=0, ge=0)
    default_project_credits: int = Field(default=0, ge=0)
    default_internship_credits: int = Field(default=0, ge=0)
    syllabus_summary: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ProgramCoursePlacementImportData(BaseModel):
    """Program course placement data for import"""
    course_code: str = Field(..., description="Course code")
    group_name: Optional[str] = Field(None, description="Course group name")
    block_name: Optional[str] = Field(None, description="Knowledge block name")
    total_credits: Optional[int] = Field(None, ge=0)
    lecture_credits: Optional[int] = Field(None, ge=0)
    practical_credits: Optional[int] = Field(None, ge=0)
    project_credits: Optional[int] = Field(None, ge=0)
    internship_credits: Optional[int] = Field(None, ge=0)
    prereq_course_codes: List[str] = Field(default_factory=list)
    coreq_course_codes: List[str] = Field(default_factory=list)
    prereq_condition: Optional[str] = None
    semester_recommended: Optional[int] = Field(None, ge=1, le=12)
    year_recommended: Optional[int] = Field(None, ge=1, le=6)
    is_mandatory: bool = Field(default=True)
    note: Optional[str] = None
    display_order: int = Field(default=0, ge=0)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode='after')
    def validate_location(self) -> 'ProgramCoursePlacementImportData':
        """Either group_name or block_name must be provided"""
        if not self.group_name and not self.block_name:
            raise ValueError('Either group_name or block_name must be provided')
        return self


class CoursePLOContributionImportData(BaseModel):
    """Course-PLO contribution data for import"""
    course_code: str = Field(..., description="Course code")
    plo_code: str = Field(..., description="PLO code")
    contribution_level: int = Field(..., ge=1, le=5)
    performance_indicator: str = Field(..., min_length=1, max_length=50)
    note: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


# Request/Response schemas
class DocxParseRequest(BaseModel):
    """Request for parsing DOCX file"""
    source: ImportSource = ImportSource.PATH
    path: Optional[str] = Field(None, description="File path when source is 'path'")
    
    class Config:
        schema_extra = {
            "example": {
                "source": "path",
                "path": "./cu-nhan-nnq-2025.docx"
            }
        }


class DocxParseResponse(BaseModel):
    """Response from DOCX parsing"""
    success: bool
    data: Optional["CurriculumImportData"] = None
    warnings: List[str] = Field(default_factory=list)
    blocking_errors: List[str] = Field(default_factory=list)
    parse_metadata: Dict[str, Any] = Field(default_factory=dict)


class DocxValidateRequest(BaseModel):
    """Request for validating import data"""
    data: "CurriculumImportData"
    
    class Config:
        schema_extra = {
            "example": {
                "data": {
                    "program": {...},
                    "program_version": {...},
                    # ... other fields
                }
            }
        }


class DocxValidateResponse(BaseModel):
    """Response from validation"""
    ok: bool
    blocking_errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    validation_summary: Dict[str, Any] = Field(default_factory=dict)


class DocxCommitRequest(BaseModel):
    """Request for committing import data"""
    data: "CurriculumImportData"
    confirm: bool = Field(..., description="Confirmation flag")
    
    class Config:
        schema_extra = {
            "example": {
                "data": {...},
                "confirm": True
            }
        }


class DocxCommitResponse(BaseModel):
    """Response from commit operation"""
    success: bool
    created_ids: Dict[str, List[int]] = Field(default_factory=dict)
    counts: Dict[str, int] = Field(default_factory=dict)
    errors: List[str] = Field(default_factory=list)
    transaction_id: Optional[str] = None


# Main import data container
class CurriculumImportData(BaseModel):
    """Complete curriculum data for import"""
    program: ProgramImportData
    program_version: ProgramVersionImportData
    program_objectives: List[ProgramObjectiveImportData] = Field(default_factory=list)
    learning_outcomes: List[LearningOutcomeImportData] = Field(default_factory=list)
    plo_po_map: List[PLOPOMapImportData] = Field(default_factory=list)
    admission_criteria: Optional[AdmissionCriteriaImportData] = None
    knowledge_blocks: List[KnowledgeBlockImportData] = Field(default_factory=list)
    course_groups: List[CourseGroupImportData] = Field(default_factory=list)
    courses: List[CourseImportData] = Field(default_factory=list)
    program_course_placement: List[ProgramCoursePlacementImportData] = Field(default_factory=list)
    course_plo_contribution: List[CoursePLOContributionImportData] = Field(default_factory=list)
    
    # Metadata about the import
    import_metadata: Dict[str, Any] = Field(default_factory=dict)
    
    class Config:
        schema_extra = {
            "example": {
                "program": {
                    "code": "CNTT",
                    "vn_name": "Công nghệ thông tin",
                    "en_name": "Information Technology",
                    "faculty_name": "Khoa Công nghệ thông tin"
                },
                "program_version": {
                    "version_number": "2025-1",
                    "version_name": "Khung 2025",
                    "total_credits": "150"
                },
                "program_objectives": [
                    {
                        "code": "PO1",
                        "description": "Kiến thức nền tảng về CNTT"
                    }
                ],
                "learning_outcomes": [
                    {
                        "code": "PLO1",
                        "description": "Áp dụng kiến thức toán học"
                    }
                ],
                "plo_po_map": [
                    {
                        "plo_code": "PLO1",
                        "po_code": "PO1",
                        "mapping_strength": "strong"
                    }
                ],
                "admission_criteria": {
                    "target_group": "Học sinh THPT",
                    "selection_criteria": "Tốt nghiệp THPT"
                },
                "knowledge_blocks": [
                    {
                        "name": "Khối kiến thức nền tảng",
                        "block_type": "foundation"
                    }
                ],
                "course_groups": [
                    {
                        "name": "Nhóm môn học cơ bản",
                        "block_name": "Khối kiến thức nền tảng"
                    }
                ],
                "courses": [
                    {
                        "code": "CS101",
                        "name": "Nhập môn lập trình",
                        "default_total_credits": 3
                    }
                ],
                "program_course_placement": [
                    {
                        "course_code": "CS101",
                        "group_name": "Nhóm môn học cơ bản",
                        "total_credits": 3,
                        "semester_recommended": 1
                    }
                ],
                "course_plo_contribution": [
                    {
                        "course_code": "CS101",
                        "plo_code": "PLO1",
                        "contribution_level": 3,
                        "performance_indicator": "PI1.1"
                    }
                ]
            }
        }


# Forward references for circular imports
DocxParseResponse.update_forward_refs()
DocxValidateRequest.update_forward_refs()
DocxCommitRequest.update_forward_refs()