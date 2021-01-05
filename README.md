# PhishCatch 
PhishCatch is a Chrome extension and Dockerized back-end infrastructure that can help detect when users enter their corporate password on external websites.

The extension monitors browser activity for when a user enters their password. The behavior of the extension depends on the domain where the password is entered:
- If the site is listed in the `domains` configuration, the extension captures the password entry for a successful auth, hashes it, and stores the hash locally.
- If the site is *not* listed in the `domains` configuration, the extension hashes the entry field and compares it to the cached hashes. If there is a match, an alert is triggered.
 - The entire password field is hashed with each keystroke, so that partial password reuse can be detected - i.e. the cached corporate password is `Password1` but the external password is `Password123`, an alert will be triggered as soon as `Password1` is entered.
 - Hashes are only stored locally and are never sent to the PhishCatch server. Only metadata about the reuse event (username, external domain, referrer) is sent to the server for logging and alerting.

Misconfiguration can lead to false positives and false negatives. It is recommended that the complete detection and alerting pipeline be tested before full deployment. Please read all of the instructions including blind spots and references before implementing. 

## Configuration
The extension uses [Chrome management schema](https://developer.chrome.com/apps/manifest/storage) to obtain deployment configuration settings. These settings should be deploy using the appropriate enterprise management mechanism for the endpoint: Group Policy for domain-joined Windows systems, Jamf profile for managed macOS systems, or other configuration deployment system.

**Mandatory configurations:**
- **domains**: The list of domains where entering a corporate account password is expected and approved.
- **phishcatch_server**: The URL of the PhishCatch server.
- **psk**: The preshared key configured on the PhishCatch server.

**Optional configurations:**
- **display_reuse_alerts**: Display pop-up alerts on the endpoint when reuse is detected. The default setting is `true`.
- **registration_expiry**: The number of days that hashed passwords are cached locally. The default setting is `90`.

Policy templates and further details are available at https://github.com/palantir/phishcatch/tree/main/policy-templates

## Deployment
The extension can be made mandatory using Chrome's [ExtensionInstallForcelist](https://cloud.google.com/docs/chrome-enterprise/policies/?policy=ExtensionInstallForcelist).

Policy templates and further details are available at https://github.com/palantir/phishcatch/tree/main/policy-templates

## Blind spots for PhishCatch
- **Bogus passwords**: Each time the user enters a password in a corporate website, a hashed password is stored locally, regardless of whether or not the password is actually a corporate password. If, for example, a user mistakenly enters a personal password on a corporate website, then later enters that personal password in the correct external website, a false positive alert would be generated.
- **Altered configuration**: If the configuration for the extension is altered, PhishCatch may not locally alert or send alerts to the PhishCatch server.
- **First time use**: PhishCatch relies on the corporate password being entered. If a user has not logged into a corporate site after installation, there are no stored hashes so no comparison will occur.
- **Multiple browsers and incognito mode**: PhishCatch will not see any activity other than the Chrome profile where it is installed. It is also not enabled in incognito mode by default, so users may be able to bypass reuse detection. However, if PhishCatch is manually set to be allowed in incognito mode, cached hashes are shared between the standard and incognito windows.
- **Undetected websites**: Due to variations in website configurations, there is no way to guarantee that passwords will be collected when they are entered on every website. 
