# PhishCatch 
PhishCatch is a Chrome extension and Dockerized back-end infrastructure that can help detect when users enter their corporate password on external websites.

The extension monitors browser activity for when a user enters their password. The behavior of the extension depends on the domain where the password is entered:

- If the site is listed in the `domains` configuration, the extension captures the password entry for a successful auth, hashes it, and stores the hash locally.
- If the site is not listed in the `domains` configuration, the extension hashes the entry field and compares it to the cached hashes. If there is a match, an alert is triggered. For non-corporate domains, the entire password field is hashed with each keystroke, so that external passwords that contain the corporate passwords will be detected, even if they are not fully identical.
  - For example, say the cached corporate password is `Password1` and an external password is `Password123`. An alert will be not be triggered for entering `Pa`, `Pass`, or `Password`, but will be triggered as soon as `Password1` is entered.
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
- **enable_debug_gui**: Allow debug GUI access. The debug GUI shows the current config, currently cached data (usernames, password hashes, etc.), and allows for manual config override. The default setting is `true`.
- **enable_manual_password_entry**: Allows the user to manually populate password hashes in the PhishCatch GUI, in addition to capturing them from corporate domains. The default setting is `false`.
- **extra_annoying_alerts**: Enables endpoint alerts that require user interaction in order to proceed. The default setting is `false`.
- **faq_link**: Enables a FAQ button in the PhishCatch GUI that links to an arbitrary URL. If not present, no button will be displayed.
- **ignored_domains**: Configure sites that should be ignored. Usernames and passwords entered into sites on this list will NOT be hashed, stored, compared, or generate alerts. If not present, no domains will be ignored.
- **pbkdf2_iterations**: The number of PBKDF2 iterations used when hashing passwords. The more iterations used, the more difficult the hash will be to reverse, but will also require additional processing resources on the endpoint. The default setting is `100000`.
- **registration_expiry**: The number of days that hashed passwords are cached locally. The default setting is `90`.
- **repo_link**: Enables a "Source Code" button in the PhishCatch GUI that links to an arbitrary URL. If not present, no button will be displayed.
- **url_sanitization_level**: Determines the verbosity of the URLs sent in reuse alert webhooks. See [policy-templates](https://github.com/palantir/phishcatch/tree/main/policy-templates#url_sanitization_level) for options. The default setting is `host`.

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

## Frequently Asked Questions
### Does this send my passwords somewhere?
Absolutely not - passwords are securely hashed locally, and those hashes are never transmitted. Hashes from passwords entered on corporate domains are stored locally using Chrome's web storage, while passwords from non-corporate domains are never stored. The only external communication this extension has is for event metadata (username, external domain, referrer) so an incident response team can investigate and respond accordingly.

### Is this saving my passwords to disk? That's bad!
PhishCatch saves a one-way hash of your corporate (not personal) password(s) to disk. Specifically, it saves a salted PBKDF2-HMAC-SHA512 hash generated with 100,000 iterations. This hash would take an attacker who managed to pull it off your laptop an impractically large number of years to bruteforce. These settings are very similar to what 1Password uses to hash a master password. In general, you can think of the PhishCatch threat model as being very similar to 1Password - an attacker needs to read your password hash off disk and then crack it.

### Is web storage a safe place to put password hashes? What about XSS?
PhishCatch uses Chrome storage to save your password to disk. This storage is not accessible to websites or other extensions. The PhishCatch dev team does not believe that PhishCatch's code contains any browser-originated vulnerabilities (such as cross-site scripting) that would allow attackers access to stored hashes. Furthermore, were an attacker able to gain access to your computer's disk directly, we believe it would be technically infeasible to reverse the hashes.

### Does this let (my IT department | the PhishCatch dev team | Big Brother) see my personal passwords?
PhishCatch will not enable anyone, whether internal or external to your organization, additional ability to read your passwords. As mentioned above, corporate passwords will only be stored in a highly protected one-way hash form and will not be accessible in plaintext to anyone at any time. Personal passwords are hashed on the fly and are not stored in any capacity (not cached or otherwise written to disk).

That being said, it's important to understand that the best way to keep your personal information completely private is to use company hardware exclusively for work purposes.
