.PHONY: help install web-dev web-deploy web-install

help:
	@echo "Targets:"
	@echo "  install       Install deps for all projects"
	@echo "  web-install   Install deps for web/"
	@echo "  web-dev       Run web/ Worker locally (wrangler dev)"
	@echo "  web-deploy    Deploy web/ Worker to Cloudflare"

install: web-install

web-install:
	cd web && npm install

web-dev:
	cd web && npm run dev

web-deploy:
	cd web && npm run deploy
