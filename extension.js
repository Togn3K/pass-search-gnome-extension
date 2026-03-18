import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {getAllEntries, fuzzyScore} from './utils.js';

const MAX_RESULTS = 20;

const PassSearchButton = GObject.registerClass(
class PassSearchButton extends PanelMenu.Button {
    _init(ext) {
        super._init(0.0, 'Pass Search');
        this._ext = ext;
        this._settings = ext.getSettings();
        this._clipboardTimeoutId = null;
        this._entries = [];

        // Panel icon
        this._icon = new St.Icon({
            icon_name: 'dialog-password-symbolic',
            style_class: 'system-status-icon',
        });
        this.add_child(this._icon);

        // Build popup content
        this._buildMenu();

        // Load entries
        this._loadEntries();

        // Connect menu open/close
        this.menu.connect('open-state-changed', (_menu, open) => {
            if (open) {
                this._loadEntries();
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
                    this._searchEntry.grab_key_focus();
                    return GLib.SOURCE_REMOVE;
                });
            } else {
                this._searchEntry.set_text('');
                this._updateResults('');
            }
        });
    }

    _buildMenu() {
        // Container box for the popup
        const box = new St.BoxLayout({
            vertical: true,
            style_class: 'pass-search-container',
        });

        // Search entry
        this._searchEntry = new St.Entry({
            hint_text: 'Search passwords...',
            can_focus: true,
            track_hover: true,
            style_class: 'pass-search-entry',
        });
        this._searchEntry.clutter_text.connect('text-changed', () => {
            this._updateResults(this._searchEntry.get_text());
        });
        this._searchEntry.connect('key-press-event', (_actor, event) => {
            return this._onSearchKeyPress(event);
        });
        this._searchEntry.clutter_text.connect('activate', () => {
            const children = this._resultBox.get_children();
            if (this._selectedIndex >= 0 && this._selectedIndex < children.length)
                this._activateEntry(children[this._selectedIndex]._passEntry);
        });
        box.add_child(this._searchEntry);

        // Scrollable results area
        this._scrollView = new St.ScrollView({
            style_class: 'pass-search-scroll',
            overlay_scrollbars: true,
        });

        this._resultBox = new St.BoxLayout({
            vertical: true,
            style_class: 'pass-search-results',
        });
        this._scrollView.set_child(this._resultBox);
        box.add_child(this._scrollView);

        // Status label
        this._statusLabel = new St.Label({
            text: '',
            style_class: 'pass-search-status',
        });
        box.add_child(this._statusLabel);

        // Add box to menu via a PopupMenuSection
        const section = new PopupMenu.PopupMenuSection();
        section.actor.add_child(box);
        this.menu.addMenuItem(section);

        this._selectedIndex = -1;
    }

    _loadEntries() {
        const storeDir = GLib.getenv('PASSWORD_STORE_DIR')
            || GLib.build_filenamev([GLib.get_home_dir(), '.password-store']);
        this._entries = getAllEntries(storeDir);
        this._statusLabel.set_text(`${this._entries.length} passwords`);
    }

    _updateResults(query) {
        this._resultBox.destroy_all_children();
        this._selectedIndex = -1;

        if (query.length === 0) {
            this._statusLabel.set_text(`${this._entries.length} passwords`);
            return;
        }

        // Score and sort entries
        const scored = [];
        for (const entry of this._entries) {
            const score = fuzzyScore(query.toLowerCase(), entry.toLowerCase());
            if (score > 0)
                scored.push({entry, score});
        }

        scored.sort((a, b) => b.score - a.score);
        const results = scored.slice(0, MAX_RESULTS);

        if (results.length === 0) {
            this._statusLabel.set_text('No matches');
            return;
        }

        for (let i = 0; i < results.length; i++) {
            const {entry} = results[i];
            const row = this._createResultRow(entry, i);
            this._resultBox.add_child(row);
        }

        this._statusLabel.set_text(`${results.length} of ${scored.length} matches`);

        // Auto-select first
        this._selectedIndex = 0;
        this._highlightSelected();
    }

    _createResultRow(entry, index) {
        const row = new St.Button({
            style_class: 'pass-search-result-row',
            can_focus: false, // We handle focus ourselves via keyboard
            reactive: true,
            x_expand: true,
        });

        const rowBox = new St.BoxLayout({x_expand: true});

        // Split into path and name for nicer display
        const lastSlash = entry.lastIndexOf('/');
        let pathPart = '';
        let namePart = entry;
        if (lastSlash >= 0) {
            pathPart = entry.substring(0, lastSlash + 1);
            namePart = entry.substring(lastSlash + 1);
        }

        if (pathPart) {
            rowBox.add_child(new St.Label({
                text: pathPart,
                style_class: 'pass-search-result-path',
                y_align: Clutter.ActorAlign.CENTER,
            }));
        }

        rowBox.add_child(new St.Label({
            text: namePart,
            style_class: 'pass-search-result-name',
            y_align: Clutter.ActorAlign.CENTER,
        }));

        row.set_child(rowBox);
        row._passEntry = entry;
        row._index = index;

        row.connect('clicked', () => {
            this._activateEntry(entry);
        });

        return row;
    }

    _onSearchKeyPress(event) {
        const symbol = event.get_key_symbol();
        const children = this._resultBox.get_children();

        if (symbol === Clutter.KEY_Down) {
            if (children.length > 0) {
                this._selectedIndex = Math.min(this._selectedIndex + 1, children.length - 1);
                this._highlightSelected();
            }
            return Clutter.EVENT_STOP;
        } else if (symbol === Clutter.KEY_Up) {
            if (children.length > 0) {
                this._selectedIndex = Math.max(this._selectedIndex - 1, 0);
                this._highlightSelected();
            }
            return Clutter.EVENT_STOP;
        } else if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) {
            if (this._selectedIndex >= 0 && this._selectedIndex < children.length) {
                const row = children[this._selectedIndex];
                this._activateEntry(row._passEntry);
            }
            return Clutter.EVENT_STOP;
        } else if (symbol === Clutter.KEY_Escape) {
            this.menu.close();
            return Clutter.EVENT_STOP;
        } else if (symbol === Clutter.KEY_Tab) {
            // Tab cycles through results
            if (children.length > 0) {
                this._selectedIndex = (this._selectedIndex + 1) % children.length;
                this._highlightSelected();
            }
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _highlightSelected() {
        const children = this._resultBox.get_children();
        for (let i = 0; i < children.length; i++) {
            if (i === this._selectedIndex)
                children[i].add_style_class_name('selected');
            else
                children[i].remove_style_class_name('selected');
        }

        // Scroll selected into view
        if (this._selectedIndex >= 0 && this._selectedIndex < children.length) {
            const child = children[this._selectedIndex];
            const adj = this._scrollView.get_vscroll_bar().get_adjustment();
            const [, childY] = child.get_position();
            const childH = child.get_height();
            const scrollH = this._scrollView.get_height();
            const value = adj.get_value();

            if (childY < value)
                adj.set_value(childY);
            else if (childY + childH > value + scrollH)
                adj.set_value(childY + childH - scrollH);
        }
    }

    _activateEntry(entry) {
        this.menu.close();
        this._copyPassword(entry);
    }

    _copyPassword(entry) {
        try {
            const useOtp = this._settings.get_boolean('show-otp');
            const argv = useOtp
                ? ['pass', 'otp', entry]
                : ['pass', 'show', entry];

            const proc = Gio.Subprocess.new(
                argv,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );

            proc.communicate_utf8_async(null, null, (source, result) => {
                try {
                    const [, stdout, stderr] = source.communicate_utf8_finish(result);

                    if (source.get_successful()) {
                        const password = stdout.split('\n')[0];
                        if (password) {
                            this._copyToClipboard(password);

                            const clearSeconds = this._settings.get_int('clear-clipboard-seconds');
                            if (clearSeconds > 0)
                                this._scheduleClearClipboard(clearSeconds);

                            Main.notify('Pass Search', `Copied "${entry}" to clipboard`);
                        }
                    } else {
                        const errMsg = stderr ? stderr.trim() : 'Unknown error';
                        Main.notify('Pass Search', `Error: ${errMsg}`);
                        log(`[pass-search] Error retrieving ${entry}: ${errMsg}`);
                    }
                } catch (e) {
                    Main.notify('Pass Search', `Error: ${e.message}`);
                    log(`[pass-search] Exception in callback: ${e.message}`);
                }
            });
        } catch (e) {
            Main.notify('Pass Search', `Error: ${e.message}`);
            log(`[pass-search] Exception: ${e.message}`);
        }
    }

    _copyToClipboard(text) {
        const clipboard = St.Clipboard.get_default();
        clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
    }

    _scheduleClearClipboard(seconds) {
        if (this._clipboardTimeoutId) {
            GLib.source_remove(this._clipboardTimeoutId);
            this._clipboardTimeoutId = null;
        }

        this._clipboardTimeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            seconds,
            () => {
                this._copyToClipboard('');
                this._clipboardTimeoutId = null;
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    toggle() {
        if (this.menu.isOpen)
            this.menu.close();
        else
            this.menu.open();
    }

    destroy() {
        if (this._clipboardTimeoutId) {
            GLib.source_remove(this._clipboardTimeoutId);
            this._clipboardTimeoutId = null;
        }
        super.destroy();
    }
});


export default class PassSearchExtension extends Extension {
    enable() {
        this._button = new PassSearchButton(this);
        Main.panel.addToStatusArea('pass-search', this._button);

        // Keybinding
        this._settings = this.getSettings();
        Main.wm.addKeybinding(
            'toggle-shortcut',
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.ALL,
            () => this._button.toggle()
        );
    }

    disable() {
        Main.wm.removeKeybinding('toggle-shortcut');
        this._button?.destroy();
        this._button = null;
        this._settings = null;
    }
}
