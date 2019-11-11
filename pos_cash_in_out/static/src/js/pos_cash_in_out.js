odoo.define("pos_cash_in_out.pos_cash_in_out", function(require) {
    "use strict"

    var core = require('web.core');
    var gui = require('point_of_sale.gui');
    var PopupWidget = require('point_of_sale.popups');
    var rpc = require('web.rpc');
    var screens = require('point_of_sale.screens');

    var _t = core._t;

    var PosCashInButton = screens.ActionButtonWidget.extend({
        template: 'PosCashInButton',
        button_click: function() {
            var self = this;
            if (self.pos.config.cash_control) {
                self.gui.show_popup('put_money_in', {});
            } else {
                alert(_t('Please enable cash control from configuration and is drawer in cash journal.'));
            }
        },
    });

    var PosCashOutButton = screens.ActionButtonWidget.extend({
        template: 'PosCashOutButton',
        button_click: function() {
            var self = this;
            if (self.pos.config.cash_control) {
                self.gui.show_popup('take_money_out', {});
            } else {
                alert(_t('Please enable cash control from configuration and is drawer in cash journal.'));
            }
        },
    });

    screens.define_action_button({
        'name': 'PosCashIn',
        'widget': PosCashInButton,
        'condition': function() {
            return this.pos.config.enable_cash_in_out;
        },
    });

    screens.define_action_button({
        'name': 'PosCashOut',
        'widget': PosCashOutButton,
        'condition': function() {
            return this.pos.config.enable_cash_in_out;
        },
    });

    var PutMoneyInPopup = PopupWidget.extend({
        template: 'PutMoneyInPopup',
        show: function(options) {
            options = options || {};
            this._super(options);
            this.renderElement();
            $('#txt_reason_in_id').focus();
        },
        click_confirm: function() {
            var name = '';
            var amount = '';
            name = $('#txt_reason_in_id').val();
            amount = $('#txt_amount__in_id').val();
            if (name == '' || amount == '') {
                alert(_t("Please fill all fields."));
            } else if (!$.isNumeric(amount)) {
                alert(_t("please input valid amount"));
                $('#txt_amount__in_id').val('');
                $('#txt_amount__in_id').focus();
            } else {
                var session_id = '';
                session_id = posmodel.pos_session.id;
                rpc.query({
                        model: 'pos.session',
                        method: 'put_money_in',
                        args: [name, amount, session_id],
                    })
                    .then(function(result) {
                        if (result['error']) {
                            alert(_t(result['error']));
                        }
                    }, function(err, ev) {
                        ev.preventDefault();
                        var error_body = _t('Your Internet connection is probably down.');
                        if (err.data) {
                            var except = err.data;
                            error_body = except.arguments && except.arguments[0] || except.message || error_body;
                        }
                        self.gui.show_popup('error', {
                            'title': _t('Error: Could not Save Changes'),
                            'body': error_body,
                        });
                    });
                this.gui.close_popup();
            }
        },
        renderElement: function() {
            var self = this;
            this._super();
        },
    });
    gui.define_popup({
        name: 'put_money_in',
        widget: PutMoneyInPopup
    });

    var TakeMoneyOutPopup = PopupWidget.extend({
        template: 'TakeMoneyOutPopup',
        show: function(options) {
            options = options || {};
            this._super(options);

            this.renderElement();
            $('#txt_reason_out_id').focus();
        },
        click_confirm: function() {
            var name = '';
            var amount = '';
            name = $('#txt_reason_out_id').val();
            amount = $('#txt_amount__out_id').val();
            if (name == '' || amount == '') {
                alert(_t("Please fill all fields."));
            } else if (!$.isNumeric(amount)) {
                alert(_t("please input valid amount"));
                $('#txt_amount__out_id').val('');
                $('#txt_amount__out_id').focus();
            } else {
                var session_id = '';
                session_id = posmodel.pos_session.id;
                rpc.query({
                        model: 'pos.session',
                        method: 'take_money_out',
                        args: [name, amount, session_id],
                    })
                    .then(function(result) {
                        if (result['error']) {
                            alert(_t(result['error']));
                        }
                    }, function(err, ev) {
                        ev.preventDefault();
                        var error_body = _t('Your Internet connection is probably down.');
                        if (err.data) {
                            var except = err.data;
                            error_body = except.arguments && except.arguments[0] || except.message || error_body;
                        }
                        self.gui.show_popup('error', {
                            'title': _t('Error: Could not Save Changes'),
                            'body': error_body,
                        });
                    });
                this.gui.close_popup();
            }
        },
        renderElement: function() {
            var self = this;
            this._super();
        },
    });
    gui.define_popup({
        name: 'take_money_out',
        widget: TakeMoneyOutPopup
    });

});