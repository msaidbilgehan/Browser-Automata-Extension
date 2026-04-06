# Privacy Policy

**Browser Automata**
**Last updated:** 2026-04-06

## Summary

Browser Automata is a privacy-focused Chrome extension. All user data is stored locally on your device. No personal data is collected, transmitted, or shared with any third party.

## Data Storage

All data created and managed by Browser Automata is stored exclusively in your browser using `chrome.storage.local` and `chrome.storage.sync`:

- **Local storage** (`chrome.storage.local`): Scripts, shortcuts, flows, CSS rules, extraction rules, network rules, profiles, clipboard history, activity logs, form fill profiles, site adapters, installed templates, quick-run actions, and health metrics.
- **Sync storage** (`chrome.storage.sync`): UI preferences only (theme, icon color, execution settings, notification preferences). These sync across your devices through Chrome's built-in sync mechanism if enabled in your browser.

No data is stored on external servers.

## Data Collection

Browser Automata does **not** collect:

- Personal information (name, email, address, etc.)
- Browsing history or habits
- Analytics or telemetry data
- Tracking identifiers or cookies
- Crash reports

## Network Requests

Browser Automata makes **one** optional network request:

- **Template registry fetch**: A read-only GET request to a public GitHub repository (`raw.githubusercontent.com`) to retrieve the list of available automation templates. This request sends no user data. It occurs only when you explicitly open the Templates view or click Refresh.

No other network requests are made by the extension. No user data ever leaves your browser.

## Permissions

The extension requests the following browser permissions, used solely for automation functionality:

| Permission | Purpose |
|---|---|
| `storage` | Store your scripts, settings, and configurations locally |
| `activeTab` | Interact with the currently active tab when you trigger an action |
| `scripting` | Execute your automation scripts on web pages |
| `tabs` | Query and communicate with browser tabs |
| `alarms` | Schedule automation tasks |
| `clipboardRead` / `clipboardWrite` | Read and write clipboard content for automation workflows |
| `notifications` | Display alerts from page-monitoring rules you define |
| `declarativeNetRequest` | Apply custom network rules and CSP modifications you configure |
| `downloads` | Export your data (scripts, configurations, logs) as files |
| `<all_urls>` (host permission) | Run content scripts and automation on any website you choose |

None of these permissions are used for data collection or tracking.

## Third-Party Services

Browser Automata does not integrate with any third-party analytics, advertising, or tracking services.

## User Control

You have full control over your data:

- **View**: All stored data is accessible through the extension's UI.
- **Export**: Use Import/Export to download your data as JSON files.
- **Delete**: Remove individual items or uninstall the extension to delete all stored data.
- **Disable**: Use the global toggle to disable all extension functionality without losing data.

## Children's Privacy

Browser Automata does not knowingly collect any data from children under the age of 13.

## Changes to This Policy

If this privacy policy is updated, the changes will be reflected in this document with an updated date. Continued use of the extension after changes constitutes acceptance of the revised policy.

## Contact

If you have questions about this privacy policy, please open an issue on the [Browser Automata GitHub repository](https://github.com/msaidbilgehan/Browser-Automata-Extension).
