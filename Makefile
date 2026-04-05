.PHONY: help up down restart logs logs-app logs-db app-shell db-shell dev start test test-headed test-one test-module test-report test-excel

# Variables
APP_CONTAINER = program-app
DB_CONTAINER = program-db
DB_USER = program
DB_NAME = program_db

help: ## Hiển thị các lệnh hỗ trợ
	@echo "Các lệnh hỗ trợ:"
	@echo ""
	@echo "  Docker:"
	@echo "  make up          - Chạy chương trình với Docker Compose (chế độ ẩn)"
	@echo "  make down        - Dừng và xóa các container"
	@echo "  make restart     - Khởi động lại các container"
	@echo "  make logs        - Xem logs của tất cả container"
	@echo "  make logs-app    - Xem logs của application container"
	@echo "  make logs-db     - Xem logs của database container"
	@echo "  make app-shell   - Truy cập vào shell của application container"
	@echo "  make db-shell    - Truy cập vào PostgreSQL terminal"
	@echo ""
	@echo "  App:"
	@echo "  make dev         - Chạy chương trình ở môi trường dev local (npm run dev)"
	@echo "  make start       - Chạy chương trình ở môi trường production local (npm start)"
	@echo ""
	@echo "  Test:"
	@echo "  make test                    - Chạy toàn bộ 166 test cases"
	@echo "  make test-headed             - Chạy test với browser hiển thị"
	@echo "  make test-one TC=TC_AUTH_01  - Chạy 1 test case"
	@echo "  make test-module M=Approval  - Chạy 1 module"
	@echo "  make test-report             - Mở HTML report"
	@echo "  make test-excel              - Xuất kết quả ra TestReport.xlsx"

# --- Docker commands ---
up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f

logs-app:
	docker compose logs -f $(APP_CONTAINER)

logs-db:
	docker compose logs -f $(DB_CONTAINER)

# --- Shell inside containers ---
app-shell:
	docker exec -it $(APP_CONTAINER) sh

db-shell:
	docker exec -it $(DB_CONTAINER) psql -U $(DB_USER) -d $(DB_NAME)

# --- Local Native Commands ---
dev:
	npm run dev

start:
	npm start

# --- Test commands ---
test:
	npx playwright test

test-headed:
	npx playwright test --headed

test-one:
	npx playwright test -g "$(TC)"

test-module:
	npx playwright test -g "$(M)"

test-report:
	npx playwright show-report

test-excel:
	node tests/generate-excel-report.js
