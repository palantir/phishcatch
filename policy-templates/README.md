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
