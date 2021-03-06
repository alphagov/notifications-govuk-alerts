.PHONY: build
build: clean
	npm run build
	python build.py

.PHONY: clean
clean:
	rm -rf dist/*

.PHONY: run
run: build
	python main.py

.PHONY: bootstrap
bootstrap:
	pip install -r requirements_for_test.txt
	npm ci

.PHONY: test
test:
	isort --check-only *.py lib tests
	flake8 .
	npm run lint
	npm test
	pytest tests/
