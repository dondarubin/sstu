IMAGE_NAME = sstu_quality_app
CONTAINER_NAME = sstu_quality_app_web

.PHONY: help build up down logs shell clean

help:
	@echo "Доступные команды:"
	@echo "  make build        - Собрать Docker образ (через docker-compose)"
	@echo "  make up           - Запустить приложение (через docker-compose)"
	@echo "  make down         - Остановить и удалить контейнеры (через docker-compose)"
	@echo "  make logs         - Показать логи запущенного приложения"
	@echo "  make shell        - Зайти в shell запущенного контейнера web"
	@echo "  make restart      - Перезапустить приложение"
	@echo "  make clean        - Удалить собранный образ и все остановленные контейнеры"
	@echo "  make prune        - Удалить все неиспользуемые Docker образы, контейнеры, сети и тома (ОСТОРОЖНО!)"

build:
	docker-compose build

up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f web

shell:
	docker-compose exec web /bin/sh

restart: down up

clean: down
	@docker-compose rm -fsv
	@docker rmi $(IMAGE_NAME) || true

prune:
	docker system prune -a -f

pycache-clean:
	find . | grep -E "(__pycache__|\.py[cod]$$)" | xargs rm -rf