odoo.define('pos_lock.pos_lock', function(require) {
    "use strict"

    var core = require('web.core');
    var chrome = require('point_of_sale.chrome');
    var gui = require('point_of_sale.gui');
    var models = require('point_of_sale.models');
    var PosBaseWidget = require('point_of_sale.BaseWidget');

    var _t = core._t;

    chrome.UsernameWidget.include({
        renderElement: function() {
            var self = this;
            PosBaseWidget.prototype.renderElement.apply(this, arguments);
            this.$el.click(function(e) {
                if ($(this).attr('id') == 'disable_cancel') {
                    self.disable_cancel = true;
                    self.click_username(true);
                } else {
                    self.disable_cancel = false;
                    self.click_username();
                }
            });
        },
        click_username: function(disable_cancel = false) {
            var self = this;
            this.gui.select_user({
                'security': true,
                'current_user': this.pos.get_cashier(),
                'title': _t('Change Cashier'),
                'disable_cancel': disable_cancel,
            }).then(function(user) {
                self.pos.set_cashier(user);
                self.renderElement();
            });
        },
    });

    gui.Gui.include({
        select_user: function(options) {
            options = options || {};
            var self = this;
            var def = new $.Deferred();
            var list = [];
            for (var i = 0; i < this.pos.users.length; i++) {
                var user = this.pos.users[i];
                if (!options.only_managers || user.role === 'manager') {
                    if (user == this.pos.user) {
                        list.push({
                            'label': user.name,
                            'item': user,
                        });
                    } else {
                        for (var j = 0; j < user.groups_id.length; j++) {
                            if (self.pos.config.group_pos_user[0] == user.groups_id[j]) {
                                list.push({
                                    'label': user.name,
                                    'item': user,
                                });
                            }
                        }
                    }
                }
            }
            this.show_popup('selection', {
                'title': options.title || _t('Select User'),
                'disable_cancel': options.disable_cancel,
                list: list,
                confirm: function(user) {
                    def.resolve(user);
                },
                cancel: function() {
                    def.reject();
                },
            });

            return def.then(function(user) {
                if (options.security && user !== options.current_user && user.pos_security_pin) {
                    return self.ask_password(user.pos_security_pin).then(function() {
                        return user;
                    });
                } else if (options.security && user.pos_security_pin && self.chrome.widget.username.disable_cancel) {
                    return self.ask_password(user.pos_security_pin).then(function() {
                        return user;
                    });
                } else {
                    return user;
                }
            });
        },
        ask_password: function(password) {
            var self = this;
            var ret = new $.Deferred();
            if (password) {
                this.show_popup('password', {
                    'title': _t('Password ?'),
                    confirm: function(pw) {
                        if (pw !== password) {
                            self.incorrect_Password = true;
                            self.show_popup('error', _t('Incorrect Password'));
                            ret.reject();

                        } else {
                            ret.resolve();
                        }
                    },
                });
            } else {
                ret.resolve();
            }
            return ret;
        },
    });

    var PasswordPopupWidget;
    var ErrorPopupWidget;
    _.each(gui.Gui.prototype.popup_classes, function(popup_class) {
        if (popup_class.name == "password") {
            PasswordPopupWidget = popup_class;
        }
        if (popup_class.name == "error") {
            ErrorPopupWidget = popup_class;
        }
    });

    PasswordPopupWidget.widget.include({
        init: function(parent, args) {
            this._super(parent, args);
            var self = this;
            this.keyboard_keydown_handler = function(event) {
                if (event.keyCode === 8 || event.keyCode === 46) { // Backspace and Delete
                    event.preventDefault();
                    self.keyboard_handler(event);
                }
            };
            this.keyboard_handler = function(event) {
                if (event.keyCode === 13) { // Enter
                    self.click_confirm();
                } else {
                    self.click_numpad(event);
                }
                event.preventDefault();
            }
        },
        show: function(options) {
            this._super(options);
            $('body').keypress(this.keyboard_handler);
            $('body').keydown(this.keyboard_keydown_handler);
        },
        click_numpad: function(event) {
            var buffer;
            if ($(event.target).data && event.keyCode == undefined) {
                buffer = $(event.target).data('action');
                buffer = buffer.toString();
            }
            if (event.keyCode) {
                if (event.keyCode >= 48 && event.keyCode <= 57) {
                    buffer = event.keyCode - 48;
                    buffer = buffer.toString();
                }
                if (event.keyCode === 46) { // Delete
                    buffer = 'CLEAR';
                } else if (event.keyCode === 8) { // Backspace
                    buffer = 'BACKSPACE';
                }
            }
            if (buffer) {
                var newbuf = this.gui.numpad_input(
                    this.inputbuffer,
                    buffer, {
                        'firstinput': this.firstinput
                    });
                this.firstinput = (newbuf.length === 0);
                if (newbuf !== this.inputbuffer) {
                    this.inputbuffer = newbuf;
                    this.$('.value').text(this.inputbuffer);
                }
                var $value = this.$('.value');
                $value.text($value.text().replace(/./g, '•'));
            }
        },
        hide: function() {
            this._super.apply(this, arguments);
            $('body').off('keypress', this.keyboard_handler);
            $('body').off('keydown', this.keyboard_keydown_handler);
        },
        click_cancel: function() {
            var self = this;
            this._super();
            if (this.chrome.widget.username.disable_cancel) {
                this.gui.select_user({
                    'security': true,
                    'current_user': this.pos.get_cashier(),
                    'title': _t('Change Cashier'),
                    'disable_cancel': true,
                }).then(function(user) {
                    self.pos.set_cashier(user);
                    self.chrome.widget.username.renderElement();
                })
                this.gui.incorrect_Password = false;
            }
        },
    });

    ErrorPopupWidget.widget.include({
        click_cancel: function() {
            var self = this;
            this._super();
            if (this.gui.incorrect_Password && this.chrome.widget.username.disable_cancel) {
                this.gui.select_user({
                    'security': true,
                    'current_user': this.pos.get_cashier(),
                    'title': _t('Change Cashier'),
                    'disable_cancel': true,
                }).then(function(user) {
                    self.pos.set_cashier(user);
                    self.chrome.widget.username.renderElement();
                })
                this.gui.incorrect_Password = false;
            }
        },
    });

});