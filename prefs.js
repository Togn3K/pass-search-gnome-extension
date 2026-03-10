import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class PassSearchPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'Pass Search',
            icon_name: 'dialog-password-symbolic',
        });
        window.add(page);

        // --- Shortcut group ---
        const shortcutGroup = new Adw.PreferencesGroup({
            title: 'Keyboard Shortcut',
            description: 'Configure the shortcut to open the password search',
        });
        page.add(shortcutGroup);

        const shortcutRow = new Adw.ActionRow({
            title: 'Toggle shortcut',
            subtitle: 'Click the button and press a key combination',
        });

        const currentBinding = settings.get_strv('toggle-shortcut');
        const shortcutLabel = new Gtk.ShortcutLabel({
            accelerator: currentBinding.length > 0 ? currentBinding[0] : '',
            disabled_text: 'Disabled',
            valign: Gtk.Align.CENTER,
        });

        const editButton = new Gtk.Button({
            label: 'Set',
            valign: Gtk.Align.CENTER,
        });

        const clearButton = new Gtk.Button({
            icon_name: 'edit-clear-symbolic',
            valign: Gtk.Align.CENTER,
            tooltip_text: 'Clear shortcut',
        });

        clearButton.connect('clicked', () => {
            settings.set_strv('toggle-shortcut', []);
            shortcutLabel.set_accelerator('');
        });

        editButton.connect('clicked', () => {
            const dialog = new ShortcutDialog(window);
            dialog.connect('response', (_dlg, accelerator) => {
                if (accelerator) {
                    settings.set_strv('toggle-shortcut', [accelerator]);
                    shortcutLabel.set_accelerator(accelerator);
                }
                dialog.close();
            });
            dialog.present();
        });

        shortcutRow.add_suffix(shortcutLabel);
        shortcutRow.add_suffix(editButton);
        shortcutRow.add_suffix(clearButton);
        shortcutGroup.add(shortcutRow);

        // --- Behavior group ---
        const behaviorGroup = new Adw.PreferencesGroup({
            title: 'Behavior',
        });
        page.add(behaviorGroup);

        // Clear clipboard timeout
        const clearRow = new Adw.SpinRow({
            title: 'Clear clipboard after (seconds)',
            subtitle: 'Set to 0 to disable automatic clearing',
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 300,
                step_increment: 5,
                value: settings.get_int('clear-clipboard-seconds'),
            }),
        });
        clearRow.connect('notify::value', () => {
            settings.set_int('clear-clipboard-seconds', clearRow.get_value());
        });
        behaviorGroup.add(clearRow);

        // OTP toggle
        const otpRow = new Adw.SwitchRow({
            title: 'Use OTP mode',
            subtitle: 'Retrieve OTP codes using "pass otp" instead of passwords',
        });
        settings.bind('show-otp', otpRow, 'active', 0);
        behaviorGroup.add(otpRow);
    }
}

/**
 * Simple dialog to capture a keyboard shortcut.
 */
const ShortcutDialog = GObject.registerClass({
    Signals: {
        'response': {param_types: [GObject.TYPE_STRING]},
    },
}, class ShortcutDialog extends Adw.Window {
    _init(parent) {
        super._init({
            modal: true,
            transient_for: parent,
            title: 'Set Shortcut',
            default_width: 350,
            default_height: 200,
        });

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 20,
            margin_top: 30,
            margin_bottom: 30,
            margin_start: 30,
            margin_end: 30,
            valign: Gtk.Align.CENTER,
        });

        box.append(new Gtk.Label({
            label: 'Press a key combination...',
            css_classes: ['title-2'],
        }));

        box.append(new Gtk.Label({
            label: 'Press Escape to cancel',
            css_classes: ['dim-label'],
        }));

        this.set_content(box);

        const controller = new Gtk.EventControllerKey();
        controller.connect('key-pressed', (_ctrl, keyval, keycode, state) => {
            // Filter out modifier-only presses
            if (isModifierKey(keyval))
                return Gdk.EVENT_STOP;

            if (keyval === Gdk.KEY_Escape) {
                this.close();
                return Gdk.EVENT_STOP;
            }

            // Mask out non-modifier bits
            const mask = state & Gtk.accelerator_get_default_mod_mask();
            const accel = Gtk.accelerator_name(keyval, mask);

            if (accel) {
                this.emit('response', accel);
                return Gdk.EVENT_STOP;
            }

            return Gdk.EVENT_PROPAGATE;
        });
        this.add_controller(controller);
    }
});

function isModifierKey(keyval) {
    return [
        Gdk.KEY_Shift_L, Gdk.KEY_Shift_R,
        Gdk.KEY_Control_L, Gdk.KEY_Control_R,
        Gdk.KEY_Alt_L, Gdk.KEY_Alt_R,
        Gdk.KEY_Super_L, Gdk.KEY_Super_R,
        Gdk.KEY_Meta_L, Gdk.KEY_Meta_R,
        Gdk.KEY_Hyper_L, Gdk.KEY_Hyper_R,
    ].includes(keyval);
}
