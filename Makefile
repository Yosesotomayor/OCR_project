PROJECT_NAME ?= ocr_v3
SERVICE_NAME ?= 
FLAGS ?= -d 

.PHONY: run run_gpu
run:
	docker compose -p $(PROJECT_NAME) up $(FLAGS) --build --remove-orphans $(SERVICE_NAME)
run_gpu:
	docker compose -p $(PROJECT_NAME) -f docker-compose.yml -f docker-compose.gpu.yml up $(FLAGS) --build --remove-orphans $(SERVICE_NAME)
.PHONY: stop
stop:
	docker compose -p $(PROJECT_NAME) stop $(SERVICE_NAME)

.PHONY: down
down:
	docker compose -p $(PROJECT_NAME) down --remove-orphans

.PHONY: logs
logs:
	docker compose -p $(PROJECT_NAME) logs -f --tail=100 $(SERVICE_NAME)