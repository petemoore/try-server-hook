start-server:
	node app.js

start-consumer:
	node consumer.js

reset: reset-rabbitmq reset-gaia-try
	@echo New rabbit and gaia-try repo!

reset-rabbitmq:
	rabbitmqctl stop_app
	rabbitmqctl reset
	rabbitmqctl start_app

reset-gaia-try:
	ssh hg.mozilla.org edit gaia-try delete YES
	ssh hg.mozilla.org clone gaia-try integration/gaia-try

lint:
	gjslint --recurse . \
		--disable "220,225,0211,0110" \
		--exclude_directories "examples,node_modules,b2g,api-design"

.FORCE: test
tests:
	./node_modules/.bin/mocha

send-pr:
	#curl -X POST -d @sample_new_pr_payload.json http://localhost:7040/github/v3 \

	curl -X POST -d @sample_new_pr_payload.json https://try-server-hook.herokuapp.com/github/v3 \
		--header "Content-Type:application/json" \
		--header "X-GitHub-Event:pull_request" \
		--header "X-Hub-Signature:sha1=john" \
		--header "X-GitHub-Delivery:testing-guid"

send-push:
	curl -X POST -d @sample_push_payload.json http://localhost:7040/github/v3 \
		--header "Content-Type:application/json" \
		--header "X-GitHub-Event:push" \
		--header "X-Hub-Signature:sha1=john" \
		--header "X-GitHub-Delivery:testing-guid"
