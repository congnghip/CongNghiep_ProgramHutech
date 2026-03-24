"""API routes for DOCX import functionality"""
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, status
from fastapi.responses import JSONResponse

from app.core.deps import get_current_user, require_permission
from app.core.rbac import Permission
from app.utils import format_response
from .schemas import (
    DocxParseRequest,
    DocxParseResponse,
    DocxValidateRequest,
    DocxValidateResponse,
    DocxCommitRequest,
    DocxCommitResponse,
    ImportSource,
    CurriculumImportData
)
from .parser import parse_docx_file, parse_docx_bytes
from .validators import validate_import_data
from .services import import_curriculum_data

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/imports/docx", tags=["Nhập DOCX"])


@router.post("/parse", response_model=DocxParseResponse)
async def parse_docx(
    request: DocxParseRequest,
    current_user: dict = Depends(require_permission(Permission.PROGRAM_CREATE))
):
    """
    Parse DOCX file and extract curriculum data
    
    This endpoint accepts either a file path or uploaded file content and extracts
    structured curriculum data including programs, courses, learning outcomes, etc.
    """
    try:
        if request.source == ImportSource.PATH:
            if not request.path:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cần cung cấp đường dẫn tệp khi nguồn là 'path'."
                )
            
            # Validate file path
            file_path = Path(request.path)
            if not file_path.exists():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Không tìm thấy tệp: {request.path}"
                )
            
            if not file_path.suffix.lower() == '.docx':
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Định dạng tệp không hợp lệ. Chỉ hỗ trợ tệp .docx."
                )
            
            # Parse file
            data, warnings, blocking_errors = parse_docx_file(request.path)
            
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Nguồn không được hỗ trợ: {request.source}"
            )
        
        if blocking_errors:
            return DocxParseResponse(
                success=False,
                data=None,
                warnings=warnings,
                blocking_errors=blocking_errors,
                parse_metadata={}
            )
        
        return DocxParseResponse(
            success=True,
            data=data,
            warnings=warnings,
            blocking_errors=[],
            parse_metadata=data.import_metadata if data else {}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error parsing DOCX file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Không thể phân tích tệp DOCX: {str(e)}"
        )


@router.post("/parse-upload", response_model=DocxParseResponse)
async def parse_docx_upload(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_permission(Permission.PROGRAM_CREATE))
):
    """
    Parse uploaded DOCX file and extract curriculum data
    
    This endpoint accepts a file upload and extracts structured curriculum data.
    """
    try:
        # Validate file type
        if not file.filename or not file.filename.lower().endswith('.docx'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Định dạng tệp không hợp lệ. Chỉ hỗ trợ tệp .docx."
            )
        
        # Read file content
        file_bytes = await file.read()
        
        # Parse file
        data, warnings, blocking_errors = parse_docx_bytes(file_bytes)
        
        if blocking_errors:
            return DocxParseResponse(
                success=False,
                data=None,
                warnings=warnings,
                blocking_errors=blocking_errors,
                parse_metadata={}
            )
        
        return DocxParseResponse(
            success=True,
            data=data,
            warnings=warnings,
            blocking_errors=[],
            parse_metadata=data.import_metadata if data else {}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error parsing uploaded DOCX file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Không thể xử lý tệp DOCX đã tải lên: {str(e)}"
        )


@router.post("/validate", response_model=DocxValidateResponse)
async def validate_docx_data(
    request: DocxValidateRequest,
    current_user: dict = Depends(require_permission(Permission.PROGRAM_CREATE))
):
    """
    Validate curriculum data extracted from DOCX
    
    This endpoint performs comprehensive validation of the extracted data,
    checking for business rules, referential integrity, and constraints.
    """
    try:
        # Validate data
        is_valid, warnings, blocking_errors, validation_summary = await validate_import_data(request.data)
        
        return DocxValidateResponse(
            ok=is_valid,
            blocking_errors=blocking_errors,
            warnings=warnings,
            validation_summary=validation_summary
        )
        
    except Exception as e:
        logger.error(f"Error validating DOCX data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Không thể kiểm tra dữ liệu import: {str(e)}"
        )


@router.post("/commit", response_model=DocxCommitResponse)
async def commit_docx_data(
    request: DocxCommitRequest,
    current_user: dict = Depends(require_permission(Permission.PROGRAM_CREATE))
):
    """
    Commit validated curriculum data to database
    
    This endpoint performs the actual import operation, creating all records
    in a single transaction. Requires prior validation.
    """
    try:
        if not request.confirm:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Thiếu xác nhận nhập dữ liệu. Vui lòng đặt confirm=true để tiếp tục."
            )
        
        # First validate the data
        is_valid, warnings, blocking_errors, validation_summary = await validate_import_data(request.data)
        
        if not is_valid:
            return DocxCommitResponse(
                success=False,
                created_ids={},
                counts={},
                errors=blocking_errors,
                transaction_id=None
            )
        
        # Import data
        success, created_ids, counts, errors, transaction_id = await import_curriculum_data(
            request.data,
            current_user['id']
        )
        
        if not success:
            return DocxCommitResponse(
                success=False,
                created_ids={},
                counts={},
                errors=errors,
                transaction_id=transaction_id
            )

        return DocxCommitResponse(
            success=True,
            created_ids=created_ids,
            counts=counts,
            errors=[],
            transaction_id=transaction_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error committing DOCX data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Không thể ghi dữ liệu import vào hệ thống: {str(e)}"
        )


@router.get("/templates")
async def get_import_templates(
    current_user: dict = Depends(get_current_user)
):
    """
    Get information about supported DOCX templates and formats
    
    This endpoint provides guidance on the expected DOCX structure and
    formatting for successful import.
    """
    try:
        templates = {
            "supported_formats": [".docx"],
            "required_sections": [
                {
                    "name": "Thông tin chương trình",
                    "description": "Bao gồm mã chương trình, tên tiếng Việt, tên tiếng Anh và khoa quản lý",
                    "required_fields": [
                        {"field": "program_code", "description": "Mã chương trình duy nhất"},
                        {"field": "program_name_vn", "description": "Tên chương trình bằng tiếng Việt"},
                        {"field": "program_name_en", "description": "Tên chương trình bằng tiếng Anh"},
                        {"field": "faculty_name", "description": "Tên khoa/đơn vị (đã có trong hệ thống)"}
                    ]
                },
                {
                    "name": "Mục tiêu chương trình (PO)",
                    "description": "Liệt kê các mục tiêu ở cấp chương trình",
                    "format": "PO1: Nội dung mô tả mục tiêu"
                },
                {
                    "name": "Chuẩn đầu ra chương trình (PLO)",
                    "description": "Trình bày các chuẩn đầu ra và mức năng lực",
                    "format": "PLO1: Nội dung mô tả chuẩn đầu ra"
                },
                {
                    "name": "Ma trận liên kết PLO-PO",
                    "description": "Bảng thể hiện mối liên hệ giữa PLO và PO",
                    "format": "Bảng với PLO ở hàng và PO ở cột, điền mức độ liên kết"
                },
                {
                    "name": "Cấu trúc khối kiến thức",
                    "description": "Danh sách khối kiến thức và nhóm học phần theo phân cấp",
                    "format": "Bảng gồm khối, nhóm học phần và thông tin tín chỉ"
                },
                {
                    "name": "Danh mục học phần",
                    "description": "Danh sách học phần cùng số tín chỉ",
                    "format": "Bảng gồm mã học phần, tên, tín chỉ và thông tin chính"
                },
                {
                    "name": "Ma trận đóng góp học phần - PLO",
                    "description": "Bảng thể hiện mức độ đóng góp của từng học phần cho từng PLO",
                    "format": "Bảng với học phần ở hàng và PLO ở cột"
                }
            ],
            "optional_sections": [
                {
                    "name": "Điều kiện tuyển sinh",
                    "description": "Yêu cầu đầu vào dành cho người học"
                },
                {
                    "name": "Thông tin phiên bản",
                    "description": "Bao gồm tên phiên bản, thời gian hiệu lực, trạng thái"
                }
            ],
            "formatting_guidelines": [
                "Sử dụng tiêu đề rõ ràng cho từng mục (ví dụ: 'THÔNG TIN CHƯƠNG TRÌNH', 'CHUẨN ĐẦU RA')",
                "Mã chương trình và mã học phần cần thống nhất với quy định của trường",
                "Sử dụng bảng cho các ma trận và dữ liệu có cấu trúc",
                "Bảo đảm tên và mã thống nhất trong toàn bộ tài liệu",
                "Ghi rõ nguồn gốc hoặc đơn vị quản lý của từng phần dữ liệu"
            ],
            "common_errors": [
                "Trùng mã chương trình hoặc mã học phần",
                "Thiếu hoặc sai tên khoa/đơn vị",
                "Định dạng mã không thống nhất",
                "Thiếu các mục bắt buộc",
                "Ma trận liên kết không đúng cấu trúc"
            ]
        }
        
        return format_response(templates)
        
    except Exception as e:
        logger.error(f"Error getting import templates: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Không thể tải thông tin mẫu import: {str(e)}"
        )


@router.get("/status")
async def get_import_status(
    current_user: dict = Depends(get_current_user)
):
    """
    Get system status for DOCX import functionality
    
    This endpoint provides information about the import system status,
    including available dependencies and system health.
    """
    try:
        # Check python-docx availability
        try:
            import docx
            docx_available = True
        except ImportError:
            docx_available = False
        
        status = {
            "system_status": "healthy",
            "system_status_label": "Hệ thống hoạt động ổn định" if docx_available else "Thiếu thành phần phụ thuộc",
            "dependencies": {
                "python_docx": "available" if docx_available else "unavailable"
            },
            "supported_operations": [
                "parse_docx_path",
                "parse_docx_upload",
                "validate_data",
                "commit_data"
            ],
            "limits": {
                "max_file_size": "50MB",
                "supported_formats": [".docx"]
            },
            "recommendations": [
                "Kiểm tra dữ liệu trước khi nhập",
                "Giữ định dạng tên và mã thống nhất",
                "Đảm bảo thông tin khoa/đơn vị đã tồn tại"
            ]
        }
        
        if not docx_available:
            status["system_status"] = "degraded"
            status["errors"] = ["Thư viện python-docx chưa được cài đặt"]
        
        return format_response(status)
        
    except Exception as e:
        logger.error(f"Error getting import status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Không thể lấy trạng thái hệ thống: {str(e)}"
        )
