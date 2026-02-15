# PhishCatch Local Debug and Testing hints

The JSON below can be used to test this extension with the **new** User Query logging feature.

1. It adds the following domains as enterprise domains:

"chat.openai.com",
"chatgpt.com",
"openai.com",
"platform.openai.com"

2. Debug logging in the service worker is enable via the new property:

   "enable_debug_logging": true,

3. Fetch request logging is enabled on ChatGPT via the following entry:
   This new feature will inspect the 'body' of a Fetch POST Request looking for a specific property of the JSON data in it.
   Since most modern web sites utilize the Post requests to send data to server this considered a flexible approach to capture data in least intrusive way.

   The following configuration is required ror each host that you wish to capture user queries.
   3a. The host (or domain) of the site to monitor must be a key in the "capture_enterprise_domains" and a matching entry should be in the "enterprise_domains" array.
   3b. The "requestURL" must match the URL of the Fetch request for a specific host or domain
   3c. The "requestObjectPath" is used to traverse the object that is contained in the body of the Fetch Request

```
  "chatgpt.com": {
        "requestObjectPath": "messages.0.content.parts.0",
        "requestURL": "https://chatgpt.com/backend-api/f/conversation"
      }
```

The complete JSON configuration:

```
{
  "data_expiry": 30,
  "display_reuse_alerts": true,
  "enable_debug_gui": true,
  "enable_debug_logging": true,
  "enterprise_domains": [
    "*.nytimes.com",
    "*.wikipedia.org",
    "*.expertvoice.com",
    "chat.openai.com",
    "chatgpt.com",
    "openai.com",
    "platform.openai.com"
  ],
  "expire_hash_on_use": false,
  "faq_link": null,
  "hash_truncation_amount": 0,
  "ignored_domains": [],
  "manual_password_entry": false,
  "pbkdf2_iterations": 100000,
  "phishcatch_server": "http://localhost:8000",
  "psk": "",
  "repo_link": null,
  "url_sanitization_level": "host",
  "username_regexes": [],
  "username_selectors": [],
  "banned_urls": [],
  "capture_enterprise_domains": {
    "chatgpt.com": {
      "requestObjectPath": "messages.0.content.parts.0",
      "requestURL": "https://chatgpt.com/backend-api/f/conversation"
    }
  }
}
```

The following commands can be run to build and run the test server.

```
cd phishcatch/server
docker build -t phishcatch-server .
docker run --rm -p 8000:80 phishcatch-server
```
