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

class AlertModel(BaseModel):
    username: str
    url: str
    psk: str
    referrer: Optional[str] = None
    alertType: str
    date: str

preshared_key = os.environ.get('PRESHARED_KEY')
if preshared_key is None:
    print("No preshared key! Be careful!")

webhook_url = os.environ.get('SLACK_WEBHOOK')
if webhook_url is None:
    print("No slack webhook defined, logging only mode")

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
        webhook_url, 
        data=json.dumps(data), 
        headers={'Content-Type': 'application/json'}
    )

    logging.info('Slack response: ' + str(response.text))
    logging.info('Slack response code: ' + str(response.status_code))


###############################################################################
# Index endpoint. Used to test connection
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
# curl -X POST http://localhost:8000/alert --data '{"username":"bob","url":"https://www.grubhub.com","psk":"foobar","referrer":"https://www.google.com","alertType":"reuse"}'
#
###############################################################################
@app.post("/alert")
def alert(alert: AlertModel, request: Request, response: Response):
    logging.info("Received a credential reuse alert!")
    
    if (alert.psk != preshared_key):
        logging.info("Alert did not include correct pre-shared key! Correct key: {preshared_key}. Provided key: {alert.psk}")
        response.status_code = 400
        return {"status": "Incorrect PSK"}

    if (alert.alertType == "reuse"):
        message = f"A user with associated usernames {alert.username} reused their password on {alert.url}! Referrer: {alert.referrer}. Timestamp: {alert.date}. Request IP: {request.client.host}."
    elif (alert.alertType == "domhash"):
        message = f"{alert.url} triggered a dom hash alert for a user with associated usernames {alert.username}. Timestamp: {alert.date}. Request IP: {request.client.host}."
    elif (alert.alertType == "userreport"):
        message = f"A user with associated usernames {alert.username} reported {alert.url} as a phishing page. Referrer: {alert.referrer}. Timestamp: {alert.date}. Request IP: {request.client.host}."
    elif (alert.alertType == "falsepositive"):
        message = f"A user with associated usernames {alert.username} reported a false positive alert on {alert.url}. Referrer: {alert.referrer}. Timestamp: {alert.date}. Request IP: {request.client.host}."
    elif (alert.alertType == "personalpassword"):
        message = f"A user with associated usernames {alert.username} reported that phishcatch alerted on a personal password at {alert.url}. Referrer: {alert.referrer}. Timestamp: {alert.date}. Request IP: {request.client.host}."
    else:
        logging.error("Invalid alert type")
        message = f"A user with associated usernames {alert.username} fired an unknown alert on {alert.url}! Referrer: {alert.referrer}. Timestamp: {alert.date}. Request IP: {request.client.host}. Is the server up to date?"

    logging.info(message)

    try:
        slack_alert_handler(message)
    except Exception as error:
        logging.error(error)
        response.status_code = 500
        return {"status": "Couldn't send slack alert"}

    return {"status": "alert success"}
