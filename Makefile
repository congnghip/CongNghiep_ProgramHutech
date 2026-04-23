.PHONY: help up down restart logs logs-app logs-db app-shell db-shell dev start

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

# --- Docker commands ---
up:
	docker compose up -d --build

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
