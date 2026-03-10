# Pass Search - GNOME Shell Extension

A GNOME Shell extension for quickly searching and retrieving passwords from [pass](https://www.passwordstore.org/) (the standard unix password manager).

## Features

- **Panel icon** in the top bar to open the search popup
- **Keyboard shortcut** (`Super+P` by default, configurable)
- **Fuzzy search** across all entries, including nested folders — results are ranked by relevance (exact substrings, word boundaries, consecutive matches)
- **Keyboard navigation** — Arrow keys to move, Enter to copy, Escape to close, Tab to cycle
- **Automatic clipboard clearing** after 45 seconds (configurable, or disable it)
- **OTP support** — optionally retrieve OTP codes via `pass otp`
- **Respects `$PASSWORD_STORE_DIR`** — uses the standard password store location or a custom one

## Requirements

- GNOME Shell 49
- [pass](https://www.passwordstore.org/) installed and configured
- GPG agent running (so `pass show` can decrypt without blocking)
- *(Optional)* [pass-otp](https://github.com/tadfisher/pass-otp) for OTP support

## Installation

### Manual (from source)

```bash
# Clone or copy the extension to the GNOME Shell extensions directory
mkdir -p ~/.local/share/gnome-shell/extensions/
cp -r pass-search@togn3k ~/.local/share/gnome-shell/extensions/

# Compile the GSettings schema
glib-compile-schemas ~/.local/share/gnome-shell/extensions/pass-search@togn3k/schemas/

# Enable the extension
gnome-extensions enable pass-search@togn3k
```

Then restart GNOME Shell:
- **Wayland**: log out and log back in
- **X11**: press `Alt+F2`, type `r`, press Enter

### From extensions.gnome.org

Search for **"Pass Search"** on [extensions.gnome.org](https://extensions.gnome.org/) and click Install.

## Usage

1. Press `Super+P` (or click the lock icon in the top bar)
2. Start typing to fuzzy-search your passwords
3. Use arrow keys to navigate, Enter to copy the password to clipboard
4. The clipboard is automatically cleared after 45 seconds

## Configuration

Open the extension preferences via GNOME Extensions app, or:

```bash
gnome-extensions prefs pass-search@togn3k
```

Available settings:

| Setting | Default | Description |
|---|---|---|
| Toggle shortcut | `Super+P` | Keyboard shortcut to open/close the popup |
| Clear clipboard after | 45 seconds | Auto-clear clipboard (0 to disable) |
| Use OTP mode | Off | Use `pass otp` instead of `pass show` |

## File structure

```
pass-search@togn3k/
├── metadata.json       # Extension metadata
├── extension.js        # Main extension logic (panel button, popup, clipboard)
├── utils.js            # Password store traversal and fuzzy matching
├── prefs.js            # Preferences window (shortcut, clipboard, OTP)
├── stylesheet.css      # Popup styling
└── schemas/
    └── org.gnome.shell.extensions.pass-search.gschema.xml
```

## License

GPL-3.0
