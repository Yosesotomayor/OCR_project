SERVICE_NAME ?= 
FLAGS ?=

.PHONY: run run_gpu
run:
	docker compose up $(FLAGS) --build --remove-orphans $(SERVICE_NAME)
run_gpu:
	docker compose -f docker-compose.yml -f docker-compose.gpu.yml up $(FLAGS) --build --remove-orphans $(SERVICE_NAME)
.PHONY: stop
stop:
	docker compose stop $(SERVICE_NAME)

.PHONY: down
down:
	docker compose down --remove-orphans

.PHONY: logs
logs:
	docker compose logs -f --tail=100 $(SERVICE_NAME)