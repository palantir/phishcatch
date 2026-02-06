# Copyright 2020 Palantir Technologies

# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at

#     http://www.apache.org/licenses/LICENSE-2.0

# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import os
import json
import uuid
import random
import string
import logging
import configparser
from typing import Optional
from fastapi import FastAPI, Response, Request, status
from mangum import Mangum
from pydantic import BaseModel
from datetime import datetime
import requests

app = FastAPI()
web_handler = Mangum(app)

preshared_key = os.environ.get('PRESHARED_KEY')
if preshared_key is None:
    print("No preshared key! Be careful!")

webhook_url = os.environ.get('SLACK_WEBHOOK')
if webhook_url is None:
    print("No slack webhook defined, logging only mode")

class AlertModel(BaseModel):
    alertUrl: str
    allAssociatedUsernames: str
    psk: str
    referrer: Optional[str] = None
    alertTimestamp: int
    alertType: str
    suspectedUsername: Optional[str] = 'null'
    suspectedHost: Optional[str] = 'null'
    clientId: str

class ActivityModel(BaseModel):
    eventType: str
    source: str
    content: str
    url: str
    timestamp: int
    metadata: Optional[dict] = None
    psk: str
    clientId: str

# Monitoring rules served to the extension. To add a new monitored app,
# add a rule here and release the backend — no extension update needed.
MONITORING_RULES = [
    {
        "id": "chatgpt",
        "source": "chatgpt",
        "domains": ["chatgpt.com", "chat.openai.com"],
        "strategy": "fetch_intercept",
        "eventType": "user_input",
        "fetchConfig": {
            "urlPattern": "/backend-api/conversation",
            "method": "POST",
            "extractPath": ["messages", -1, "content", "parts"],
            "filterPath": ["messages", -1, "role"],
            "filterValue": "user",
            "join": "\n"
        }
    }
]


###############################################################################
# Status endpoint. Used to test connection
#
# curl -X GET http://localhost:8000/status
#    
###############################################################################
@app.get("/status")
def health_check():
    return {"status": "healthy"}

###############################################################################
# Alerting endpoint
#
# curl -X POST http://localhost:8000/alert --data '{"allAssociatedUsernames":"bob","alertUrl":"https://www.grubhub.com","psk":"foobar","referrer":"https://www.google.com","alertType":"reuse","suspectedUsername":"testuser","suspectedHost":"testhost","alertTimestamp":1611703424585,"clientId":"foo"}'
#
###############################################################################
@app.post("/alert")
def alert(alert: AlertModel, request: Request, response: Response):
    logging.info("Received a credential reuse alert!")
    
    if (preshared_key):
        if (alert.psk != preshared_key):
            logging.info("Alert did not include correct pre-shared key! Correct key: {preshared_key}. Provided key: {alert.psk}")
            response.status_code = 400
            return {"status": "Incorrect PSK"}

    logging_message = f"src_ip={request.client.host} "

    for key in alert:
        if (key[0] == "alertTimestamp"):
            key = (key[0], friendly_timestamp(key[1]))
        if (key[0] != "psk"):
            logging_message += f"{key[0]}={key[1]} "

    logging.info(logging_message)

    if (alert.alertType == "reuse"):
        friendly_message = f"A user with associated usernames {alert.allAssociatedUsernames} reused their password on {alert.alertUrl}!"
    elif (alert.alertType == "domhash"):
        friendly_message = f"{alert.alertUrl} triggered a dom hash alert for a user with associated usernames {alert.allAssociatedUsernames}."
    elif (alert.alertType == "userreport"):
        friendly_message = f"A user with associated usernames {alert.allAssociatedUsernames} reported {alert.alertUrl} as a phishing page."
    elif (alert.alertType == "falsepositive"):
        friendly_message = f"A user with associated usernames {alert.allAssociatedUsernames} reported a false positive alert on {alert.alertUrl}."
    elif (alert.alertType == "personalpassword"):
        friendly_message = f"A user with associated usernames {alert.allAssociatedUsernames} reported that PhishCatch alerted on a personal password at {alert.alertUrl}."
    else:
        logging.error("Invalid alert type")
        friendly_message = f"A user with associated usernames {alert.allAssociatedUsernames} fired an unknown alert on {alert.alertUrl}! Referrer: {alert.referrer}. Is the server up to date?"

    if alert.suspectedUsername is not 'null' and alert.suspectedUsername is not 'null':
        friendly_message += f" Suspected account for this leak: {alert.suspectedUsername} from {alert.suspectedHost}."
    friendly_message += f" Referrer: {alert.referrer}. Timestamp: {alert.alertTimestamp}. Client ID: {alert.clientId}."
    friendly_message += f" Request IP: {request.client.host}"

    logging.info(friendly_message)

    try:
        slack_alert_handler(friendly_message)
    except Exception as error:
        logging.error(error)
        response.status_code = 500
        return {"status": "Couldn't send slack alert"}

    return {"status": "alert success"}

###############################################################################
# Monitoring rules endpoint. Returns rules that tell the extension what to
# monitor. Update these to add/modify monitored apps — no extension update.
#
# curl -X GET http://localhost:8000/monitoring-rules
#
###############################################################################
@app.get("/monitoring-rules")
def get_monitoring_rules():
    return MONITORING_RULES


###############################################################################
# Activity logging endpoint. Receives user activity events from the extension.
#
# curl -X POST http://localhost:8000/activity --data '{"eventType":"user_input","source":"chatgpt","content":"Hello world","url":"https://chatgpt.com","timestamp":1611703424585,"psk":"foobar","clientId":"foo"}'
#
###############################################################################
@app.post("/activity")
def log_activity(activity: ActivityModel, request: Request, response: Response):
    logging.info("Received an activity event!")

    if (preshared_key):
        if (activity.psk != preshared_key):
            logging.info(f"Activity did not include correct pre-shared key! Provided key: {activity.psk}")
            response.status_code = 400
            return {"status": "Incorrect PSK"}

    logging_message = f"src_ip={request.client.host} "
    for key, value in activity:
        if key == "timestamp":
            value = friendly_timestamp(value)
        if key != "psk":
            logging_message += f"{key}={value} "
    logging.info(logging_message)

    content_preview = activity.content[:200] if activity.content else ""
    friendly_message = (
        f"Activity detected: [{activity.source}] {activity.eventType} "
        f"on {activity.url}. Content: \"{content_preview}\". "
        f"Client: {activity.clientId}. IP: {request.client.host}"
    )
    logging.info(friendly_message)

    try:
        slack_alert_handler(friendly_message)
    except Exception as error:
        logging.error(error)
        response.status_code = 500
        return {"status": "Couldn't send slack alert"}

    return {"status": "activity logged"}


def friendly_timestamp(timestamp):
    datetime.fromtimestamp(timestamp / 1000).isoformat()

def slack_alert_handler(message: str):
    if webhook_url is None:
        return

    logging.info("Attempting to send slack alert!")

    logging.info(message)
    send_slack_alert(username='AlertingBot!', message=message, emoji=':robot_face:')

def send_slack_alert(username: str, message: str, emoji: str):
    logging.info("Sending slack alert")
    
    data = {
        'text': message,
        'username': username,
        'icon_emoji': emoji
    }

    response = requests.post(
        str(webhook_url), 
        data=json.dumps(data), 
        headers={'Content-Type': 'application/json'}
    )

    logging.info('Slack response: ' + str(response.text))
    logging.info('Slack response code: ' + str(response.status_code))
