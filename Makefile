.PHONY: help install web-dev web-deploy web-install dev-ssh

help:
	@echo "Targets:"
	@echo "  install       Install deps for all projects"
	@echo "  web-install   Install deps for web/"
	@echo "  web-dev       Run web/ Worker locally (wrangler dev)"
	@echo "  web-deploy    Deploy web/ Worker to Cloudflare"
	@echo "  dev-ssh       SSH into the flujobox-dev server"

install: web-install

web-install:
	cd web && npm install

web-dev:
	cd web && npm run dev

web-deploy:
	cd web && npm run deploy

dev-ssh:
	ssh flujobox-dev
