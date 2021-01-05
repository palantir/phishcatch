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
from app.alerts.slackalert import slackalert_handler 

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
        logging.info("Alert did not include correct pre-shared key!")
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
        message = f"A user with associated usernames {alert.username} fired an unknown alert on {alert.url}! Referrer: {alert.referrer}. Timestamp: {alert.date}. Request IP: {request.client.host}."

    logging.info(message)

    try:
        slackalert_handler(message)
    except Exception as error:
        logging.error(error)
        response.status_code = 500
        return {"status": "Couldn't send slack alert"}

    return {"status": "alert success"}
