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
import asyncio
import configparser
from pathlib import Path
from typing import Optional, List
from collections import deque
from fastapi import FastAPI, Response, Request, status, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse
from mangum import Mangum
from pydantic import BaseModel
from datetime import datetime
import requests

app = FastAPI()
web_handler = Mangum(app)

# In-memory activity log for the live dashboard
activity_log: deque = deque(maxlen=100)
activity_subscribers: list = []

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

class MonitoringRuleModel(BaseModel):
    id: str
    source: str
    domains: List[str]
    strategy: str
    eventType: str
    fetchConfig: Optional[dict] = None

###############################################################################
# Monitoring rules — persisted to rules.json next to this file.
###############################################################################
RULES_FILE = Path(__file__).parent / "rules.json"

DEFAULT_RULES = [
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
            "filterPath": ["messages", -1, "author", "role"],
            "filterValue": "user",
            "join": "\n"
        }
    },
    {
        "id": "chatgpt-anon",
        "source": "chatgpt",
        "domains": ["chatgpt.com", "chat.openai.com"],
        "strategy": "fetch_intercept",
        "eventType": "user_input",
        "fetchConfig": {
            "urlPattern": "/backend-anon/f/conversation",
            "method": "POST",
            "extractPath": ["messages", -1, "content", "parts"],
            "filterPath": ["messages", -1, "author", "role"],
            "filterValue": "user",
            "join": "\n"
        }
    }
]

def load_rules() -> list:
    if RULES_FILE.exists():
        with open(RULES_FILE, "r") as f:
            return json.load(f)
    # First run — seed with defaults
    save_rules(DEFAULT_RULES)
    return list(DEFAULT_RULES)

def save_rules(rules: list):
    with open(RULES_FILE, "w") as f:
        json.dump(rules, f, indent=2)

monitoring_rules: list = load_rules()


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

    for key, value in alert:
        if key == "alertTimestamp":
            value = friendly_timestamp(value)
        if key != "psk":
            logging_message += f"{key}={value} "

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

    if alert.suspectedUsername != 'null' and alert.suspectedHost != 'null':
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
    return monitoring_rules


###############################################################################
# Rules CRUD API — used by the rules dashboard.
###############################################################################
@app.get("/api/rules")
def list_rules():
    return monitoring_rules

@app.post("/api/rules", status_code=201)
def create_rule(rule: MonitoringRuleModel):
    if any(r["id"] == rule.id for r in monitoring_rules):
        raise HTTPException(status_code=409, detail=f"Rule '{rule.id}' already exists")
    monitoring_rules.append(rule.model_dump())
    save_rules(monitoring_rules)
    return rule.model_dump()

@app.put("/api/rules/{rule_id}")
def update_rule(rule_id: str, rule: MonitoringRuleModel):
    for i, r in enumerate(monitoring_rules):
        if r["id"] == rule_id:
            monitoring_rules[i] = rule.model_dump()
            save_rules(monitoring_rules)
            return rule.model_dump()
    raise HTTPException(status_code=404, detail=f"Rule '{rule_id}' not found")

@app.delete("/api/rules/{rule_id}")
def delete_rule(rule_id: str):
    for i, r in enumerate(monitoring_rules):
        if r["id"] == rule_id:
            monitoring_rules.pop(i)
            save_rules(monitoring_rules)
            return {"status": "deleted"}
    raise HTTPException(status_code=404, detail=f"Rule '{rule_id}' not found")


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

    # Push to live dashboard
    event_data = {
        "source": activity.source,
        "eventType": activity.eventType,
        "content": activity.content,
        "url": activity.url,
        "timestamp": activity.timestamp,
        "clientId": activity.clientId,
        "ip": request.client.host,
    }
    activity_log.append(event_data)
    for queue in activity_subscribers:
        queue.put_nowait(event_data)

    try:
        slack_alert_handler(friendly_message)
    except Exception as error:
        logging.error(error)
        response.status_code = 500
        return {"status": "Couldn't send slack alert"}

    return {"status": "activity logged"}


###############################################################################
# Live activity dashboard. Open in a browser to watch activity events
# arrive in real-time via Server-Sent Events.
#
# http://localhost:8000/activity/dashboard
#
###############################################################################
@app.get("/activity/stream")
async def activity_stream():
    queue = asyncio.Queue()
    activity_subscribers.append(queue)

    async def event_generator():
        try:
            while True:
                event = await queue.get()
                yield f"data: {json.dumps(event)}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            activity_subscribers.remove(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/activity/dashboard", response_class=HTMLResponse)
async def activity_dashboard():
    recent = list(activity_log)
    return f"""<!DOCTYPE html>
<html>
<head>
  <title>PhishCatch Activity Monitor</title>
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d1117; color: #c9d1d9; padding: 24px; }}
    h1 {{ color: #58a6ff; margin-bottom: 8px; font-size: 24px; }}
    .subtitle {{ color: #8b949e; margin-bottom: 24px; font-size: 14px; }}
    .status {{ display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #3fb950; margin-right: 8px; animation: pulse 2s infinite; }}
    @keyframes pulse {{ 0%, 100% {{ opacity: 1; }} 50% {{ opacity: 0.4; }} }}
    .tabs {{ display: flex; gap: 0; margin-bottom: 24px; border-bottom: 1px solid #30363d; }}
    .tab {{ padding: 8px 16px; color: #8b949e; text-decoration: none; border-bottom: 2px solid transparent; font-size: 14px; font-weight: 500; }}
    .tab:hover {{ color: #c9d1d9; }}
    .tab.active {{ color: #58a6ff; border-bottom-color: #58a6ff; }}
    #events {{ display: flex; flex-direction: column; gap: 8px; }}
    .event {{ background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; animation: fadeIn 0.3s ease; }}
    .event.new {{ border-left: 3px solid #58a6ff; }}
    @keyframes fadeIn {{ from {{ opacity: 0; transform: translateY(-8px); }} to {{ opacity: 1; transform: translateY(0); }} }}
    .event-header {{ display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: #8b949e; }}
    .event-source {{ background: #1f6feb; color: white; padding: 2px 8px; border-radius: 12px; font-weight: 600; font-size: 11px; text-transform: uppercase; }}
    .event-content {{ font-family: 'SF Mono', Menlo, monospace; font-size: 14px; color: #f0f6fc; white-space: pre-wrap; word-break: break-word; }}
    .event-url {{ font-size: 12px; color: #8b949e; margin-top: 8px; }}
    .empty {{ color: #8b949e; text-align: center; padding: 48px; font-style: italic; }}
  </style>
</head>
<body>
  <h1><span class="status"></span>PhishCatch Activity Monitor</h1>
  <p class="subtitle">Watching for user activity on monitored applications</p>
  <nav class="tabs">
    <a class="tab active" href="/activity/dashboard">Activity</a>
    <a class="tab" href="/rules/dashboard">Rules</a>
  </nav>
  <div id="events">
    <div class="empty" id="empty-msg">Waiting for activity events...</div>
  </div>
  <script>
    const eventsDiv = document.getElementById('events');
    const emptyMsg = document.getElementById('empty-msg');
    const recent = {json.dumps(recent)};

    function formatTime(ts) {{
      return new Date(ts).toLocaleTimeString('en-US', {{ hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }});
    }}

    function addEvent(data, isNew) {{
      if (emptyMsg) emptyMsg.remove();
      const div = document.createElement('div');
      div.className = 'event' + (isNew ? ' new' : '');
      div.innerHTML =
        '<div class="event-header">' +
          '<span class="event-source">' + data.source + '</span>' +
          '<span>' + formatTime(data.timestamp) + '</span>' +
        '</div>' +
        '<div class="event-content">' + escapeHtml(data.content) + '</div>' +
        '<div class="event-url">' + escapeHtml(data.url) + ' &middot; ' + data.eventType + '</div>';
      eventsDiv.insertBefore(div, eventsDiv.firstChild);
    }}

    function escapeHtml(s) {{
      const d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }}

    recent.forEach(e => addEvent(e, false));

    const es = new EventSource('/activity/stream');
    es.onmessage = function(e) {{
      addEvent(JSON.parse(e.data), true);
    }};
  </script>
</body>
</html>"""


###############################################################################
# Rules configuration dashboard. Manage monitoring rules at runtime.
#
# http://localhost:8000/rules/dashboard
#
###############################################################################
@app.get("/rules/dashboard", response_class=HTMLResponse)
async def rules_dashboard():
    return """<!DOCTYPE html>
<html>
<head>
  <title>PhishCatch Rules Configuration</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d1117; color: #c9d1d9; padding: 24px; }
    h1 { color: #58a6ff; margin-bottom: 8px; font-size: 24px; }
    .subtitle { color: #8b949e; margin-bottom: 24px; font-size: 14px; }
    .tabs { display: flex; gap: 0; margin-bottom: 24px; border-bottom: 1px solid #30363d; }
    .tab { padding: 8px 16px; color: #8b949e; text-decoration: none; border-bottom: 2px solid transparent; font-size: 14px; font-weight: 500; }
    .tab:hover { color: #c9d1d9; }
    .tab.active { color: #58a6ff; border-bottom-color: #58a6ff; }
    .toolbar { display: flex; justify-content: flex-end; margin-bottom: 16px; }
    .btn { padding: 6px 16px; border-radius: 6px; border: 1px solid #30363d; background: #21262d; color: #c9d1d9; cursor: pointer; font-size: 13px; font-weight: 500; }
    .btn:hover { background: #30363d; }
    .btn-primary { background: #238636; border-color: #238636; color: #fff; }
    .btn-primary:hover { background: #2ea043; }
    .btn-danger { background: #da3633; border-color: #da3633; color: #fff; }
    .btn-danger:hover { background: #f85149; }
    .btn-sm { padding: 3px 10px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; background: #161b22; border: 1px solid #30363d; border-radius: 8px; overflow: hidden; }
    th { text-align: left; padding: 10px 16px; background: #161b22; border-bottom: 1px solid #30363d; font-size: 12px; color: #8b949e; text-transform: uppercase; font-weight: 600; }
    td { padding: 10px 16px; border-bottom: 1px solid #21262d; font-size: 14px; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #1c2129; }
    .domains { display: flex; flex-wrap: wrap; gap: 4px; }
    .domain-tag { background: #1f6feb22; color: #58a6ff; padding: 1px 8px; border-radius: 12px; font-size: 12px; border: 1px solid #1f6feb44; }
    .actions { display: flex; gap: 6px; }
    .mono { font-family: 'SF Mono', Menlo, monospace; font-size: 13px; }
    .empty { color: #8b949e; text-align: center; padding: 48px; font-style: italic; }

    /* Modal */
    .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; justify-content: center; align-items: center; }
    .modal-overlay.open { display: flex; }
    .modal { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 24px; width: 560px; max-height: 90vh; overflow-y: auto; }
    .modal h2 { color: #c9d1d9; margin-bottom: 16px; font-size: 18px; }
    .field { margin-bottom: 14px; }
    .field label { display: block; font-size: 13px; color: #8b949e; margin-bottom: 4px; font-weight: 500; }
    .field input, .field textarea, .field select { width: 100%; padding: 8px 12px; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; color: #c9d1d9; font-size: 14px; font-family: inherit; }
    .field textarea { font-family: 'SF Mono', Menlo, monospace; font-size: 13px; min-height: 100px; resize: vertical; }
    .field input:focus, .field textarea:focus, .field select:focus { outline: none; border-color: #58a6ff; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
    .error-msg { color: #f85149; font-size: 13px; margin-bottom: 12px; display: none; }
  </style>
</head>
<body>
  <h1>PhishCatch Rules Configuration</h1>
  <p class="subtitle">Manage monitoring rules for the browser extension</p>
  <nav class="tabs">
    <a class="tab" href="/activity/dashboard">Activity</a>
    <a class="tab active" href="/rules/dashboard">Rules</a>
  </nav>
  <div class="toolbar">
    <button class="btn btn-primary" onclick="openCreate()">+ New Rule</button>
  </div>
  <div id="table-container"></div>

  <!-- Modal -->
  <div class="modal-overlay" id="modal">
    <div class="modal">
      <h2 id="modal-title">New Rule</h2>
      <div class="error-msg" id="modal-error"></div>
      <div class="field">
        <label>Rule ID</label>
        <input id="f-id" placeholder="e.g. my-app" />
      </div>
      <div class="field">
        <label>Source</label>
        <input id="f-source" placeholder="e.g. chatgpt" />
      </div>
      <div class="field">
        <label>Domains (comma-separated)</label>
        <input id="f-domains" placeholder="e.g. example.com, app.example.com" />
      </div>
      <div class="field">
        <label>Strategy</label>
        <select id="f-strategy">
          <option value="fetch_intercept">fetch_intercept</option>
          <option value="dom_observer">dom_observer</option>
          <option value="input_capture">input_capture</option>
        </select>
      </div>
      <div class="field">
        <label>Event Type</label>
        <input id="f-eventType" placeholder="e.g. user_input" value="user_input" />
      </div>
      <div class="field">
        <label>fetchConfig (JSON, optional)</label>
        <textarea id="f-fetchConfig" placeholder='{"urlPattern": "/api/...", "method": "POST", ...}'></textarea>
      </div>
      <div class="modal-actions">
        <button class="btn" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="modal-save" onclick="saveRule()">Save</button>
      </div>
    </div>
  </div>

  <script>
    let rules = [];
    let editingId = null;

    async function loadRules() {
      const res = await fetch('/api/rules');
      rules = await res.json();
      render();
    }

    function escapeHtml(s) {
      const d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }

    function render() {
      const c = document.getElementById('table-container');
      if (rules.length === 0) {
        c.innerHTML = '<div class="empty">No monitoring rules configured. Click "+ New Rule" to add one.</div>';
        return;
      }
      let html = '<table><thead><tr><th>ID</th><th>Source</th><th>Domains</th><th>URL Pattern</th><th>Actions</th></tr></thead><tbody>';
      for (const r of rules) {
        const domains = (r.domains || []).map(d => '<span class="domain-tag">' + escapeHtml(d) + '</span>').join('');
        const urlPat = r.fetchConfig ? escapeHtml(r.fetchConfig.urlPattern || '') : '';
        html += '<tr>' +
          '<td class="mono">' + escapeHtml(r.id) + '</td>' +
          '<td>' + escapeHtml(r.source) + '</td>' +
          '<td><div class="domains">' + domains + '</div></td>' +
          '<td class="mono">' + urlPat + '</td>' +
          '<td><div class="actions">' +
            '<button class="btn btn-sm" onclick="openEdit(\\'' + escapeHtml(r.id) + '\\')">Edit</button>' +
            '<button class="btn btn-sm btn-danger" onclick="deleteRule(\\'' + escapeHtml(r.id) + '\\')">Delete</button>' +
          '</div></td></tr>';
      }
      html += '</tbody></table>';
      c.innerHTML = html;
    }

    function openCreate() {
      editingId = null;
      document.getElementById('modal-title').textContent = 'New Rule';
      document.getElementById('f-id').value = '';
      document.getElementById('f-id').disabled = false;
      document.getElementById('f-source').value = '';
      document.getElementById('f-domains').value = '';
      document.getElementById('f-strategy').value = 'fetch_intercept';
      document.getElementById('f-eventType').value = 'user_input';
      document.getElementById('f-fetchConfig').value = '';
      hideError();
      document.getElementById('modal').classList.add('open');
    }

    function openEdit(id) {
      const rule = rules.find(r => r.id === id);
      if (!rule) return;
      editingId = id;
      document.getElementById('modal-title').textContent = 'Edit Rule';
      document.getElementById('f-id').value = rule.id;
      document.getElementById('f-id').disabled = true;
      document.getElementById('f-source').value = rule.source;
      document.getElementById('f-domains').value = (rule.domains || []).join(', ');
      document.getElementById('f-strategy').value = rule.strategy;
      document.getElementById('f-eventType').value = rule.eventType;
      document.getElementById('f-fetchConfig').value = rule.fetchConfig ? JSON.stringify(rule.fetchConfig, null, 2) : '';
      hideError();
      document.getElementById('modal').classList.add('open');
    }

    function closeModal() {
      document.getElementById('modal').classList.remove('open');
    }

    function showError(msg) {
      const el = document.getElementById('modal-error');
      el.textContent = msg;
      el.style.display = 'block';
    }
    function hideError() {
      document.getElementById('modal-error').style.display = 'none';
    }

    async function saveRule() {
      const id = document.getElementById('f-id').value.trim();
      const source = document.getElementById('f-source').value.trim();
      const domainsRaw = document.getElementById('f-domains').value.trim();
      const strategy = document.getElementById('f-strategy').value;
      const eventType = document.getElementById('f-eventType').value.trim();
      const fetchConfigRaw = document.getElementById('f-fetchConfig').value.trim();

      if (!id || !source || !domainsRaw || !eventType) {
        showError('ID, source, domains, and event type are required.');
        return;
      }

      const domains = domainsRaw.split(',').map(d => d.trim()).filter(Boolean);
      let fetchConfig = null;
      if (fetchConfigRaw) {
        try { fetchConfig = JSON.parse(fetchConfigRaw); }
        catch (e) { showError('fetchConfig is not valid JSON.'); return; }
      }

      const body = { id, source, domains, strategy, eventType, fetchConfig };
      const isEdit = editingId !== null;
      const url = isEdit ? '/api/rules/' + encodeURIComponent(editingId) : '/api/rules';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showError(data.detail || 'Failed to save rule.');
        return;
      }

      closeModal();
      await loadRules();
    }

    async function deleteRule(id) {
      if (!confirm('Delete rule "' + id + '"?')) return;
      await fetch('/api/rules/' + encodeURIComponent(id), { method: 'DELETE' });
      await loadRules();
    }

    // Close modal on overlay click
    document.getElementById('modal').addEventListener('click', function(e) {
      if (e.target === this) closeModal();
    });

    loadRules();
  </script>
</body>
</html>"""


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
