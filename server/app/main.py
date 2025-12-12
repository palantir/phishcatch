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
from typing import Optional, Union, List
from typing_extensions import Literal
from fastapi import FastAPI, Response, Request, status
from mangum import Mangum
from pydantic import BaseModel, Field
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

class CredentialAlertContent(BaseModel):
    allAssociatedUsernames: str
    alertUrl: str
    suspectedUsername: Optional[str] = None
    suspectedHost: Optional[str] = None
    referrer: Optional[str] = None

class ConversationRequest(BaseModel):
    url: str
    method: str

class ConversationAlertContent(BaseModel):
    request: ConversationRequest
    userInputs: List[str]

class CredentialAlert(BaseModel):
    type: Literal["reuse", "domhash", "userreport", "falsepositive", "personalpassword"]
    timestamp: int
    psk: str
    clientId: str
    content: CredentialAlertContent

class ConversationAlert(BaseModel):
    type: Literal["conversation"]
    timestamp: int
    psk: str
    clientId: str
    content: ConversationAlertContent

# Discriminated union for Alert types
AlertModel = Union[CredentialAlert, ConversationAlert]


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
    logging.info("Received an alert!")
    
    # Validate PSK for all alerts
    if preshared_key:
        if alert.psk != preshared_key:
            logging.info(f"Alert did not include correct pre-shared key! Correct key: {preshared_key}. Provided key: {alert.psk}")
            response.status_code = 400
            return {"status": "Incorrect PSK"}

    # Handle credential alerts
    if isinstance(alert, CredentialAlert):
        content = alert.content

        # Build logging message
        logging_message = f"src_ip={request.client.host} type={alert.type} timestamp={friendly_timestamp(alert.timestamp)} "
        logging_message += f"alertUrl={content.alertUrl} allAssociatedUsernames={content.allAssociatedUsernames} "
        logging_message += f"clientId={alert.clientId}"
        if content.suspectedUsername:
            logging_message += f" suspectedUsername={content.suspectedUsername}"
        if content.suspectedHost:
            logging_message += f" suspectedHost={content.suspectedHost}"
        if content.referrer:
            logging_message += f" referrer={content.referrer}"
        
        logging.info(logging_message)

        # Build friendly message based on alert type
        if alert.type == "reuse":
            friendly_message = f"A user with associated usernames {content.allAssociatedUsernames} reused their password on {content.alertUrl}!"
        elif alert.type == "domhash":
            friendly_message = f"{content.alertUrl} triggered a dom hash alert for a user with associated usernames {content.allAssociatedUsernames}."
        elif alert.type == "userreport":
            friendly_message = f"A user with associated usernames {content.allAssociatedUsernames} reported {content.alertUrl} as a phishing page."
        elif alert.type == "falsepositive":
            friendly_message = f"A user with associated usernames {content.allAssociatedUsernames} reported a false positive alert on {content.alertUrl}."
        elif alert.type == "personalpassword":
            friendly_message = f"A user with associated usernames {content.allAssociatedUsernames} reported that PhishCatch alerted on a personal password at {content.alertUrl}."
        else:
            logging.error(f"Invalid alert type: {alert.type}")
            friendly_message = f"A user with associated usernames {content.allAssociatedUsernames} fired an unknown alert on {content.alertUrl}! Referrer: {content.referrer}. Is the server up to date?"

        if content.suspectedUsername and content.suspectedUsername != 'null':
            friendly_message += f" Suspected account for this leak: {content.suspectedUsername} from {content.suspectedHost}."
        
        referrer_str = content.referrer if content.referrer else "N/A"
        friendly_message += f" Referrer: {referrer_str}. Timestamp: {friendly_timestamp(alert.timestamp)}. Client ID: {alert.clientId}."
        friendly_message += f" Request IP: {request.client.host}"

    # Handle conversation alerts
    elif isinstance(alert, ConversationAlert):
        content = alert.content
        request_url = content.request.url
        request_method = content.request.method
        user_inputs = content.userInputs

        logging_message = f"src_ip={request.client.host} type={alert.type} timestamp={friendly_timestamp(alert.timestamp)} "
        logging_message += f"request_url={request_url} request_method={request_method} "
        logging_message += f"userInputs_count={len(user_inputs)} clientId={alert.clientId}"
        logging.info(logging_message)

        # Format user inputs (limit to first 500 chars for safety)
        user_inputs_preview = ', '.join(user_inputs[:3])  # Show first 3 inputs
        if len(user_inputs) > 3:
            user_inputs_preview += f" ... ({len(user_inputs) - 3} more)"

        friendly_message = f"ChatGPT conversation intercepted! User submitted {len(user_inputs)} input(s) to {request_url} (method: {request_method}). "
        friendly_message += f"Inputs: {user_inputs_preview}. "
        friendly_message += f"Timestamp: {friendly_timestamp(alert.timestamp)}. Client ID: {alert.clientId}. Request IP: {request.client.host}"

    else:
        logging.error(f"Unknown alert type received: {type(alert)}")
        response.status_code = 400
        return {"status": "Invalid alert type"}

    logging.info(friendly_message)

    try:
        slack_alert_handler(friendly_message)
    except Exception as error:
        logging.error(error)
        response.status_code = 500
        return {"status": "Couldn't send slack alert"}

    return {"status": "alert success"}

def friendly_timestamp(timestamp: int) -> str:
    """Convert milliseconds timestamp to ISO format string."""
    return datetime.fromtimestamp(timestamp / 1000).isoformat()

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
