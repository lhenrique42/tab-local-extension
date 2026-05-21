# TabLocal — Privacy Practices Disclosure

## Data Collection

TabLocal does **not** collect, transmit, or share any user data with third parties.

## Data Storage

All user data — saved tab groups, collections, and settings — is stored exclusively in **`chrome.storage.local`** on the user's device. This storage is:

- Local-only: data never leaves the device.
- Not synced: `chrome.storage.sync` is not used.
- Not transmitted: no network requests are made for user data.

## Permissions Used

| Permission        | Purpose                                                              |
| ----------------- | -------------------------------------------------------------------- |
| `tabs`            | Read open tab URLs and titles to save sessions.                      |
| `tabGroups`       | Optionally mirror native Chrome tab group color/title into saved data.|
| `storage`         | Persist saved groups, collections, and settings locally.             |
| `favicon`         | Load favicon URLs for display in the workspace.                      |
| `unlimitedStorage`| Prevent Chrome from evicting storage when the quota is reached.      |

## No Remote Code

TabLocal does not use `eval()` or load remote scripts. The extension bundle is fully self-contained. All code is reviewed at build time via ESLint (no-eval).

## User Control

- **Export**: users can download all stored data as a JSON file at any time.
- **Import**: users can restore or migrate data from a previously exported file.
- **Delete**: clearing `chrome.storage.local` (via Chrome settings or DevTools) removes all extension data permanently.

## Third-Party Services

None. TabLocal makes no outbound network calls.
