# Installing the extension



### Force-installing the extension

Setting a force-install policy causes the extension to be installed silently, without user interaction, and prevents users from uninstalling or turning off the extension. This is the preferred installation option as it ensures the most coverage.

If the extension is installed from the Chrome Web Store, only the extension ID is required. If installing from a source other than the Chrome Web Store (i.e. you are packing and hosting the extension on your own internal network), the ID of the packed extension will need to be followed by a semicolon (;) and the URL of the Update Manifest XML. For details on self-hosting extensions, see the [Chrome extension developer resources](https://developer.chrome.com/extensions/hosting).

Note that force-installing an extension will disable Chrome's Developer Tools for this extension by default, in order to prevent users from altering the extension source code. This behavior can be modified with the DeveloperToolsDisabled policy.

**Reference**: https://cloud.google.com/docs/chrome-enterprise/policies/?policy=ExtensionInstallForcelist

#### Windows (GPO)
```
SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist\01 (REG_SZ) = jgegnlkclgfifjphjmijnkmicfgckmah
SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist\02 (REG_SZ) = jgegnlkclgfifjphjmijnkmicfgckmah;https://PATH-TO-INTERNAL-RESOURCE/updates.xml
```

#### macOS
```
<dict>
  <key>ExtensionInstallForcelist</key>
  <array>
    <string>jgegnlkclgfifjphjmijnkmicfgckmah</string>
    <string>jgegnlkclgfifjphjmijnkmicfgckmah;https://PATH-TO-INTERNAL-RESOURCE/updates.xml</string>
  </array>
</dict>
```

### Re-enabling Developer Tools

By default, force-installing an extension will disable Chrome's Developer Tools for this extension, but will remain available in all other contexts. However, it may be useful to access Developer Tools for this extension for troubleshooting.

**Reference**: https://cloud.google.com/docs/chrome-enterprise/policies/?policy=DeveloperToolsAvailability

#### Windows (GPO)
```
SOFTWARE\Policies\Google\Chrome\DeveloperToolsAvailability (REG_DWORD) = 0x1
```

#### macOS
```
<dict>
  <key>DeveloperToolsAvailability</key>
	<integer>1</integer>
</dict>
```

### Allowing installation when extensions are blocked by default

If the ExtensionInstallBlocklist policy is set to `*`, the extension ID will need to be added to the allowlist in order to be installed normally. Extensions installed via ExtensionInstallForcelist are not subject to the blocklist, but it is prudent to explicitly add them to the allowlist regardless.

**Reference**: https://cloud.google.com/docs/chrome-enterprise/policies/?policy=ExtensionInstallAllowlist

#### Windows (GPO)
```
SOFTWARE\Policies\Google\Chrome\ExtensionInstallAllowlist\01 (REG_DWORD) = jgegnlkclgfifjphjmijnkmicfgckmah
```

#### macOS
```
<dict>
	<key>ExtensionInstallAllowlist</key>
	<array>
		<string>jgegnlkclgfifjphjmijnkmicfgckmah</string>
	</array>
</dict>
```

# Configuring the extension

## Mandatory configuration settings

### domains

Configure sites authorized to use enterprise credentials. Passwords entered into sites on this list will be hashed and stored locally, and compared to passwords entered on any sites not on this list to determine if they are being reused. 

#### Windows (GPO)
```
SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\jgegnlkclgfifjphjmijnkmicfgckmah\policy\domains\0 (REG_SZ) = mydomain.com
SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\jgegnlkclgfifjphjmijnkmicfgckmah\policy\domains\1 (REG_SZ) = subdomain.mydomain.com
```

#### macOS
```
<dict>
  <key>domains</key>
  <array>
    <string>mydomain.com</string>
    <string>subdomain.mydomain.com</string>
  </array>
</dict>
```

### phishcatch_server

The URL of the PhishCatch server. The extension will need to be able to reach this server in order to trigger webhooks.

#### Windows (GPO)
```
SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\jgegnlkclgfifjphjmijnkmicfgckmah\policy\phishcatch_server (REG_SZ) = https://phishcatch.mydomain.com
```

#### macOS
```
<dict>
  <key>phishcatch_server</key>
  <string>https://phishcatch.mydomain.com</string>
</dict>
```

### psk

The preshared key configured on the PhishCatch server. This key must match or webhooks will not be triggered.

#### Windows (GPO)
```
SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\jgegnlkclgfifjphjmijnkmicfgckmah\policy\psk (REG_SZ) = MYPSK123
```

#### macOS
```
<dict>
  <key>psk</key>
  <string>MYPSK123</string>
</dict>
```

## Optional configuration settings

### display_reuse_alerts

Enable or disable password reuse alert toast notifications on the endpoint. The default setting is `true`.

#### Windows (GPO)
```
SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\jgegnlkclgfifjphjmijnkmicfgckmah\policy\display_reuse_alerts (REG_DWORD) = 0x1 | 0x0
```

#### macOS
```
<dict>
  <key>display_reuse_alerts</key>
  <true/> | <false/>
</dict>
```

### enable_debug_gui

Enable or disable access to the debug GUI on the endpoint. The debug GUI shows the current config, currently cached data (usernames, password hashes, etc.), and allows for manual config override. The default setting is `true`.

#### Windows (GPO)
```
SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\jgegnlkclgfifjphjmijnkmicfgckmah\policy\enable_debug_gui (REG_DWORD) = 0x1 | 0x0
```

#### macOS
```
<dict>
  <key>enable_debug_gui</key>
  <true/> | <false/>
</dict>
```

### enable_manual_password_entry

Allows the user to manually populate password hashes in the PhishCatch GUI, in addition to capturing them from corporate domains. The default setting is `false`.

#### Windows (GPO)
```
SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\jgegnlkclgfifjphjmijnkmicfgckmah\policy\enable_manual_password_entry
 (REG_DWORD) = 0x1 | 0x0
```

#### macOS
```
<dict>
  <key>enable_manual_password_entry</key>
  <true/> | <false/>
</dict>
```

### extra_annoying_alerts

Enables endpoint alerts that require user interaction in order to proceed. The default setting is `false`.

#### Windows (GPO)
```
SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\jgegnlkclgfifjphjmijnkmicfgckmah\policy\extra_annoying_alerts
 (REG_DWORD) = 0x1 | 0x0
```

#### macOS
```
<dict>
  <key>extra_annoying_alerts</key>
  <true/> | <false/>
</dict>
```

### faq_link

Enables a FAQ button in the PhishCatch GUI that links to an arbitrary URL. If not present, no button will be displayed.

#### Windows (GPO)
```
SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\jgegnlkclgfifjphjmijnkmicfgckmah\policy\faq_link
 (REG_SZ) = https://wiki.mydomain.com/PhishCatch
```

#### macOS
```
<dict>
  <key>faq_link</key>
  <string>https://wiki.mydomain.com/PhishCatch</string>
</dict>
```

### ignored_domains

Configure sites that should be ignored. Usernames and passwords entered into sites on this list will *NOT* be hashed, stored, compared, or generate alerts. If not present, no domains will be ignored.

#### Windows (GPO)
```
SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\jgegnlkclgfifjphjmijnkmicfgckmah\policy\ignored_domains\00 (REG_SZ) = ignored.mydomain.com
SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\jgegnlkclgfifjphjmijnkmicfgckmah\policy\ignored_domains\01 (REG_SZ) = *.ignoreme.local
```

#### macOS
```
<dict>
  <key>ignored_domains</key>
  <array>
    <string>ignored.mydomain.com</string>
    <string>*.ignoreme.local</string>
  </array>
</dict>
```

### pbkdf2_iterations

The number of PBKDF2 iterations used when hashing passwords. The more iterations used, the more difficult the hash will be to reverse, but will also require additional processing resources on the endpoint. The default setting is `100000`.

#### Windows (GPO)
```
SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\jgegnlkclgfifjphjmijnkmicfgckmah\policy\pbkdf2_iterations (REG_DWORD, decimal) = 100000
```

#### macOS
```
<dict>
  <key>pbkdf2_iterations</key>
  <integer>100000</integer>
</dict>
```

### registration_expiry

The number of days that hashed passwords are cached locally. The default setting is `90`.

#### Windows (GPO)
```
SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\jgegnlkclgfifjphjmijnkmicfgckmah\policy\registration_expiry (REG_DWORD, decimal) = 90
```

#### macOS
```
<dict>
  <key>registration_expiry</key>
  <integer>90</integer>
</dict>
```

### repo_link

Enables a "Source Code" button in the PhishCatch GUI that links to an arbitrary URL. If not present, no button will be displayed.

#### Windows (GPO)
```
SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\jgegnlkclgfifjphjmijnkmicfgckmah\policy\repo_link
 (REG_SZ) = https://github.com/palantir/phishcatch
```

#### macOS
```
<dict>
  <key>repo_link</key>
  <string>https://github.com/palantir/phishcatch</string>
</dict>
```

### url_sanitization_level

Determines the verbosity of the URLs sent in reuse alert webhooks. Options are:
- `host`: Alerts redact all URL parameters other than the hostname (e.g. `example.com/foo?token=bar` becomes `example.com`)
- `path`: Alerts include the hostname and path (e.g. `example.com/foo?token=bar` becomes `example.com/foo`)
- `none`: No sanitization is performed, potentially logging sensitive auth tokens (e.g. `example.com/foo?token=bar` remains `example.com/foo?token=bar`)

The default setting is `host`.

#### Windows (GPO)
```
SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\jgegnlkclgfifjphjmijnkmicfgckmah\policy\url_sanitization_level
 (REG_SZ) = host
```

#### macOS
```
<dict>
  <key>url_sanitization_level</key>
  <string>host</string>
</dict>
```
