start-server:
	node app.js

start-consumer:
	node consumer.js

reset-rabbitmq:
	rabbitmqctl stop_app
	rabbitmqctl reset
	rabbitmqctl start_app

lint:
	gjslint --recurse . \
		--disable "220,225,0211,0110" \
		--exclude_directories "examples,node_modules,b2g,api-design"

send-pr:
	curl -X POST -d @sample_new_pr_payload.json http://localhost:7040/github/v3 \
		--header "Content-Type:application/json" \
		--header "X-GitHub-Event:pull_request" \
		--header "X-GitHub-Delivery:testing-guid"
