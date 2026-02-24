IMAGE_NAME = pyspark_uv
PWD = $(shell pwd)

.PHONY: build dev test clean

build:
	docker build -t $(IMAGE_NAME) .


dev:
	docker run -it --rm \
		-v $(PWD):/app \
		$(IMAGE_NAME) /bin/bash

test:
	docker run --rm $(IMAGE_NAME) uv run pytest


clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name ".uv" -exec rm -rf {} +