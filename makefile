COMPOSE_FILE = docker-compose.yaml
IMAGE_NAME = sstu_image
CONTAINER_NAME = sstu_container

# Команды Docker Compose
up:
	docker-compose -f $(COMPOSE_FILE) up --build

down:
	docker-compose -f $(COMPOSE_FILE) down

logs:
	docker-compose -f $(COMPOSE_FILE) logs -f web

restart:
	docker-compose -f $(COMPOSE_FILE) restart web

shell:
	docker-compose -f $(COMPOSE_FILE) exec web /bin/sh

# Команды для сборки образа напрямую (без compose)
build:
	docker build -t $(IMAGE_NAME) .

run: build
	docker run -d -p 9090:9090 --name $(CONTAINER_NAME) $(IMAGE_NAME)

stop:
	docker stop $(CONTAINER_NAME)
	docker rm $(CONTAINER_NAME)

# Очистка
clean-images:
	docker rmi $(IMAGE_NAME) || true

prune:
	docker system prune -af