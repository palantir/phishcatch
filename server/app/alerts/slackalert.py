import os
import json
import requests
import logging
from typing import Optional
from pydantic import BaseModel

webhook_url = os.environ.get('SLACK_WEBHOOK')

def slackalert_handler(message: str):
    logging.info("Attempting to send slack alert!")
    if not webhook_url:
        logging.info("No webhook defined!")
        return

    logging.info(message)
    sendSlackAlert(username='AlertingBot!', message=message, emoji=':robot_face:')

def sendSlackAlert(username: str, message: str, emoji: str):
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
