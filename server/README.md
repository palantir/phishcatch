# PhishCatch Open Source Server

A simple FastAPI app featuring a Slack webhook integration.

## Installation

Deploying the PhishCatch server is as simple as cloning this repo, building an image using the Dockerfile, and deploying. For info on building and running Docker images, follow the [Docker Getting Started documentation](https://docs.docker.com/get-started/).

### Environmental variables

The PhishCatch server needs to be configured with two environmental variables to be fully functional. For info on declaring environment variables, see the [Docker environment variables documentation](https://docs.docker.com/compose/environment-variables/).

- **PRESHARED_KEY**: An arbitrary string that will also be set in the configuration of the browser extension to enable external alerting. 
- **SLACK_WEBHOOK**: The URL of the Slack webhook that will be used for triggering alerts. For info on setting up an incoming webhook, see the [Slack documentation](https://api.slack.com/messaging/webhooks).

