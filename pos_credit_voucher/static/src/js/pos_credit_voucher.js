odoo.define('pos_credit_voucher.pos_credit_voucher', function(require) {
    "use strict";

    var ajax = require('web.ajax');
    var core = require('web.core');
    var DB = require('point_of_sale.DB');
    var gui = require('point_of_sale.gui');
    var models = require('point_of_sale.models');
    var PopupWidget = require('point_of_sale.popups');
    var rpc = require('web.rpc');
    var utils = require('web.utils');
    var screens = require('point_of_sale.screens');
    var session = require('web.session');

    var round_pr = utils.round_precision;
    var round_di = utils.round_decimals;

    var QWeb = core.qweb;
    var _t = core._t;

    var is_pos_reservation_install = _.contains(session.module_list, 'pos_reservation');

    models.load_fields("res.partner", ['remaining_amount']);
    models.load_fields("account.journal", ['pos_front_display', 'is_credit_voucher_journal']);

    var _super_Order = models.Order.prototype;
    models.Order = models.Order.extend({
        initialize: function(attributes, options) {
            this.set({
                credit_voucher_receipt_mode: false,
            });
            this.credit_voucher = [];
            this.print_credit_voucher = false;
            this.redeem_credit_voucher = [];
            this.total_credit_voucher_redeem_amount = 0;
            _super_Order.initialize.apply(this, arguments);
        },
        export_as_JSON: function() {
            var json = _super_Order.export_as_JSON.apply(this, arguments);
            var self = this;
            json.credit_voucher = this.get_credit_voucher();
            json.redeem_credit_voucher = this.get_redeem_credit_voucher();
            json.print_credit_voucher = this.get_print_credit_voucher();
            json.credit_journal_id = (self.pos.config.enable_credit_voucher && self.pos.config.enable_credit_journal_id) ? self.pos.config.enable_credit_journal_id[0] : false;
            json.is_pos_reservation_install = is_pos_reservation_install;
            json.total_credit_voucher_redeem_amount = this.get_total_credit_voucher_redeem_amount();
            json.pos_reference = this.get('pos_reference') ? this.get('pos_reference') : this.get_name();
            return json;
        },
        init_from_JSON: function(json) {
            _super_Order.init_from_JSON.apply(this, arguments);
            if (json.credit_voucher && json.credit_voucher[0]) {
                this.set_credit_voucher(json.credit_voucher[0]);
            }
            if (json.redeem_credit_voucher && json.redeem_credit_voucher[0]) {
                this.set_redeem_credit_voucher(json.redeem_credit_voucher[0]);
            }
            if (json.print_credit_voucher) {
                this.set_print_credit_voucher(json.print_credit_voucher);
            }
            if (json.total_credit_voucher_redeem_amount) {
                this.set_total_credit_voucher_redeem_amount(json.total_credit_voucher_redeem_amount);
            }
        },
        set_total_credit_voucher_redeem_amount: function(total_credit_voucher_redeem_amount) {
            this.total_credit_voucher_redeem_amount = this.total_credit_voucher_redeem_amount + total_credit_voucher_redeem_amount;
            this.trigger('change', this);
        },
        get_total_credit_voucher_redeem_amount: function() {
            return this.total_credit_voucher_redeem_amount;
        },
        set_credit_voucher: function(credit_voucher) {
            if (credit_voucher && credit_voucher != 'null' && credit_voucher != undefined) {
                this.credit_voucher.push(credit_voucher);
            } else {
                this.credit_voucher = [];
            }
            this.trigger('change', this);
        },
        get_credit_voucher: function() {
            return this.credit_voucher;
        },
        set_print_credit_voucher: function(credit_voucher) {
            this.print_credit_voucher = credit_voucher;
            this.trigger('change', this);
        },
        get_print_credit_voucher: function() {
            return this.print_credit_voucher;
        },
        set_redeem_credit_voucher: function(redeem_credit_voucher) {
            if (redeem_credit_voucher && redeem_credit_voucher != 'null' && redeem_credit_voucher != undefined) {
                this.redeem_credit_voucher.push(redeem_credit_voucher);
            } else {
                this.redeem_credit_voucher = [];
            }
            this.trigger('change', this);
        },
        get_redeem_credit_voucher: function() {
            return this.redeem_credit_voucher;
        },
        remove_paymentline: function(line) {
            if (line && line.get_payment_redeem_credit_voucher().length != 0) {
                this.remove_credit_voucher(line.get_payment_redeem_credit_voucher())
                this.set_total_credit_voucher_redeem_amount(-line.get_credit_voucher_redeem_amount());
            }
            _super_Order.remove_paymentline.apply(this, arguments);
        },
        remove_credit_voucher: function(code) {
            var self = this;
            if (this.redeem_credit_voucher && this.redeem_credit_voucher.length > 0 && code && code.length > 0) {
                _.each(code, function(cd) {
                    var index = self.redeem_credit_voucher.indexOf(cd);
                    if (index > -1) {
                        self.redeem_credit_voucher.splice(index, 1);
                        self.trigger('change', self);
                    }
                });
            }
        },
        get_due_amount: function(paymentline) {
            if (this.get_total_with_tax() < 0) {
                if (!paymentline) {
                    var due = this.get_total_with_tax() - this.get_total_paid();
                } else {
                    var due = this.get_total_with_tax();
                    var lines = this.paymentlines.models;
                    for (var i = 0; i < lines.length; i++) {
                        if (lines[i] === paymentline) {
                            break;
                        } else {
                            due -= lines[i].get_amount();
                        }
                    }
                }
                return round_pr(due, this.pos.currency.rounding);
            } else {
                return 1;
            }
        },
        export_for_printing: function() {
            var json = _super_Order.export_for_printing.apply(this, arguments);
            var order = this;
            var order_credit_vouchers = order.get_credit_voucher();
            var print_credit_voucher = order.get_print_credit_voucher();
            var credit_voucher_details = {};
            var credit_voucher_src = false;
            _.each(order_credit_vouchers, function(order_credit_voucher) {
                var bar_val = order_credit_voucher;
                if (bar_val && print_credit_voucher) {
                    var barcode = bar_val.credit_voucher_no;
                    if (barcode) {
                        var barcode_val = barcode.toString();
                        var barcodeTemplate = QWeb.render('credit_voucherbarcode', {
                            widget: this,
                            barcode: barcode_val
                        });
                        $(barcodeTemplate).find('#barcode_credit_voucher').removeClass(barcode.toString());
                        $(barcodeTemplate).find('#barcode_credit_voucher').barcode(barcode_val.toString(), "code128");
                        if (_.isElement($(barcodeTemplate).find('#barcode_credit_voucher').barcode(barcode_val.toString(), "code128")[0])) {
                            if ($(barcodeTemplate).find('#barcode_credit_voucher').barcode(barcode_val.toString(), "code128")[0].firstChild != undefined &&
                                $(barcodeTemplate).find('#barcode_credit_voucher').barcode(barcode_val.toString(), "code128")[0].firstChild.data != undefined) {
                                credit_voucher_src = $(barcodeTemplate).find('#barcode_credit_voucher').barcode(barcode_val.toString(), "code128")[0].firstChild.data;
                            }
                        }
                        credit_voucher_details[barcode] = {
                            'data': [order_credit_voucher],
                            'src': credit_voucher_src,
                            'voucher_no': barcode
                        }
                    }
                }
            });
            var order_redeem_credit_vouchers = order.get_redeem_credit_voucher();
            var redeem_credit_voucher_details = {};
            var redeem_credit_voucher_src = false;
            _.each(order_redeem_credit_vouchers, function(order_redeem_credit_voucher) {
                var bar_val = order_redeem_credit_voucher;
                if (bar_val) {
                    var barcode = bar_val.redeem_credit_voucher;
                    if (barcode) {
                        if (Number(order_redeem_credit_voucher.redeem_remaining) > 0) {
                            var barcode_val = barcode.toString();
                            var barcodeTemplate = QWeb.render('credit_voucherbarcode', {
                                widget: this,
                                barcode: barcode_val
                            });
                            $(barcodeTemplate).find('#barcode_credit_voucher').removeClass(barcode.toString());
                            $(barcodeTemplate).find('#barcode_credit_voucher').barcode(barcode_val.toString(), "code128");
                            if (_.isElement($(barcodeTemplate).find('#barcode_credit_voucher').barcode(barcode_val.toString(), "code128")[0])) {
                                if ($(barcodeTemplate).find('#barcode_credit_voucher').barcode(barcode_val.toString(), "code128")[0].firstChild != undefined &&
                                    $(barcodeTemplate).find('#barcode_credit_voucher').barcode(barcode_val.toString(), "code128")[0].firstChild.data != undefined) {
                                    redeem_credit_voucher_src = $(barcodeTemplate).find('#barcode_credit_voucher').barcode(barcode_val.toString(), "code128")[0].firstChild.data;
                                }
                            }
                            redeem_credit_voucher_details[barcode] = {
                                'data': [order_redeem_credit_voucher],
                                'src': redeem_credit_voucher_src,
                                'voucher_no': barcode
                            }
                        } else {
                            delete redeem_credit_voucher_details[barcode];
                        }
                    }
                }
            });
            json.credit_voucher_details = credit_voucher_details;
            json.redeem_credit_voucher_details = redeem_credit_voucher_details;
            return json;
        },
    });

    var _super_paymentline = models.Paymentline.prototype;
    models.Paymentline = models.Paymentline.extend({
        initialize: function(attributes, options) {
            var self = this;
            this.payment_charge = 0;
            this.code = false;
            this.redeem_credit_voucher = [];
            this.credit_voucher_redeem_amount = 0;
            _super_paymentline.initialize.apply(this, arguments);
        },
        init_from_JSON: function(json) {
            _super_paymentline.init_from_JSON.apply(this, arguments);
            this.set_credit_voucher_line_code(json.code)
            this.set_payment_charge(json.payment_charge);
            this.credit_voucher_redeem_amount = json.credit_voucher_redeem_amount;
            if (json.redeem_credit_voucher && json.redeem_credit_voucher[0]) {
                this.set_payment_redeem_credit_voucher(json.redeem_credit_voucher[0]);
            }
        },
        set_credit_voucher_redeem_amount: function(value) {
            this.credit_voucher_redeem_amount = round_di(parseFloat(value) || 0, this.pos.currency.decimals);
            this.trigger('change', this);
        },
        get_credit_voucher_redeem_amount: function() {
            return this.credit_voucher_redeem_amount;
        },
        export_as_JSON: function() {
            var json = _super_paymentline.export_as_JSON.apply(this, arguments);
            json.code = this.get_credit_voucher_line_code();
            json.payment_charge = this.get_payment_charge();
            json.redeem_credit_voucher = this.get_payment_redeem_credit_voucher();
            json.credit_voucher_redeem_amount = this.get_credit_voucher_redeem_amount();
            return json;
        },
        set_credit_voucher_line_code: function(code) {
            this.code = code;
            this.trigger('change', this);
        },
        set_payment_redeem_credit_voucher: function(redeem_credit_voucher) {
            if (redeem_credit_voucher && redeem_credit_voucher != 'null' && redeem_credit_voucher != undefined) {
                this.redeem_credit_voucher.push(redeem_credit_voucher);
            } else {
                this.redeem_credit_voucher = [];
            }
            this.trigger('change', this);
        },
        get_payment_redeem_credit_voucher: function() {
            return this.redeem_credit_voucher;
        },
        get_credit_voucher_line_code: function() {
            return this.code;
        },
        set_payment_charge: function(val) {
            this.payment_charge = val;
            this.trigger('change', this);
        },
        get_payment_charge: function(val) {
            return this.payment_charge;
        },
    });

    screens.PaymentScreenWidget.include({
        is_credit_voucher: function() {
            var self = this;
            var order = self.pos.get_order();
            if (order && order.get_due_amount() < 0 && self.pos.config.enable_credit_voucher) {
                var timestamp = window.parseInt(new Date().getTime() / 1000);
                var expire_date = new Date();
                expire_date.setMonth(expire_date.getMonth() + self.pos.config.default_credit_exp_date);
                var year = expire_date.getFullYear();
                var month = zero_pad(expire_date.getMonth() + 1, 2);
                var day = zero_pad(expire_date.getDate(), 2);
                self.expire_date = year + "/" + month + "/" + day;
                var expire_date_format = day + "/" + month + "/" + year;
                var credit_voucher_order = {
                    'credit_voucher_no': timestamp,
                    'credit_voucher_customer_name': order.get_client() ? order.get_client().name : false,
                    'credit_voucher_expire_date': self.expire_date,
                    'credit_voucher_expire_format': expire_date_format,
                    'credit_voucher_amount': Math.abs(order.get_due_amount()),
                    'credit_voucher_customer': order.get_client() ? order.get_client().id : false,
                    'credit_voucher_issue_date': new Date(),
                }
                order.set_credit_voucher(credit_voucher_order);
                order.set_print_credit_voucher(timestamp);
            }
        },
        finalize_validation: function() {
            var self = this;
            var order = this.pos.get_order();
            if (order.is_paid_with_cash() && this.pos.config.iface_cashdrawer) {
                this.pos.proxy.open_cashbox();
            }
            order.initialize_validation_date();
            order.finalized = true;
            if (order.is_to_invoice()) {
                this.is_credit_voucher();
                var invoiced = this.pos.push_and_invoice_order(order);
                this.invoicing = true;
                invoiced.fail(function(error) {
                    self.invoicing = false;
                    order.finalized = false;
                    if (error.message === 'Missing Customer') {
                        self.gui.show_popup('confirm', {
                            'title': _t('Please select the Customer'),
                            'body': _t('You need to select the customer before you can invoice an order.'),
                            confirm: function() {
                                self.gui.show_screen('clientlist');
                            },
                        });
                    } else if (error.message === 'Backend Invoice') {
                        self.gui.show_popup('confirm', {
                            'title': _t('Please print the invoice from the backend'),
                            'body': _t('The order has been synchronized earlier. Please make the invoice from the backend for the order: ') + error.data.order.name,
                            confirm: function() {
                                this.gui.show_screen('receipt');
                            },
                            cancel: function() {
                                this.gui.show_screen('receipt');
                            },
                        });
                    } else if (error.code < 0) { // XmlHttpRequest Errors
                        self.gui.show_popup('error', {
                            'title': _t('The order could not be sent'),
                            'body': _t('Check your internet connection and try again.'),
                        });
                    } else if (error.code === 200) { // OpenERP Server Errors
                        self.gui.show_popup('error-traceback', {
                            'title': error.data.message || _t("Server Error"),
                            'body': error.data.debug || _t('The server encountered an error while receiving your order.'),
                        });
                    } else { // ???
                        self.gui.show_popup('error', {
                            'title': _t("Unknown Error"),
                            'body': _t("The order could not be sent to the server due to an unknown error"),
                        });
                    }
                });
                invoiced.done(function() {
                    self.invoicing = false;
                    self.gui.show_screen('receipt');
                });
            } else {
                this.is_credit_voucher();
                this.pos.push_order(order);
                this.gui.show_screen('receipt');
            }
        },
        renderElement: function() {
            var self = this;
            self._super();
            var order = self.pos.get_order();
            this.$('.js_credit_voucher').click(function() {
                var client = order.get_client();
                if (!order.get_credit_voucher().length > 0) {
                    self.gui.show_popup('redeem_credit_voucher_popup', {
                        'payment_self': self
                    });
                }
            });
            _.each(self.pos.cashregisters, function(cashregister) {
                if (cashregister.journal.is_credit_voucher_journal) {
                    self.$('.paymentmethod[data-id="' + cashregister.journal_id[0] + '"]').remove();
                }
            });
        },
        click_numpad: function(button) {
            var paymentlines = this.pos.get_order().get_paymentlines();
            var open_paymentline = false;
            for (var i = 0; i < paymentlines.length; i++) {
                if (!paymentlines[i].paid) {
                    open_paymentline = true;
                }
            }
            if (!open_paymentline) {
                var default_journal = this.pos.cashregisters[0];
                _.each(this.pos.cashregisters, function(cashregister) {
                    if (cashregister.journal &&
                        cashregister.journal.pos_front_display &&
                        cashregister.journal.type == 'cash') {
                        default_journal = cashregister;
                    }
                });
                this.pos.get_order().add_paymentline(default_journal);
                this.render_paymentlines();
            }
            this.payment_input(button.data('action'));
        },
    });

    var RedeemCreditvoucherPopupWidget = PopupWidget.extend({
        template: 'RedeemCreditvoucherPopupWidget',
        show: function(options) {
            self = this;
            this.payment_self = options.payment_self || false;
            this._super();
            self.redeem_credit_voucher = false;
            var order = self.pos.get_order();
            $('body').off('keypress', self.payment_self.keyboard_handler);
            $('body').off('keydown', self.payment_self.keyboard_keydown_handler);
            this.renderElement();
            $("#text_voucher_redeem_amount").keypress(function(e) {
                if (e.which != 8 && e.which != 0 && (e.which < 48 || e.which > 57) && e.which != 46) {
                    return false;
                }
            });
            $('#text_credit_voucher_no').focus();
            $('#redeem_voucher_amount_row').hide();
            $('#in_balance').hide();
            $('#text_credit_voucher_no').keypress(function(e) {
                if (e.which == 13 && $(this).val()) {
                    var today = moment().format('YYYY-MM-DD');
                    var code = $(this).val();
                    var get_redeems = order.get_redeem_credit_voucher();
                    var existing_credit_voucher = _.where(get_redeems, {
                        'redeem_credit_voucher': code
                    });
                    rpc.query({
                        model: "pos.credit.voucher",
                        method: "search_read",
                        args: [
                            [
                                ['credit_voucher_no', '=', code],
                                ['expire_date', '>=', today]
                            ]
                        ]
                    }).then(function(res) {
                        if (res.length > 0) {
                            if (res[0]) {
                                if (existing_credit_voucher.length > 0) {
                                    var sum = _.reduce(_.pluck(existing_credit_voucher, 'redeem_credit_voucher_amount'), function(memo, num) {
                                        return parseFloat(memo) + parseFloat(num);
                                    }, 0);
                                    res[0]['credit_voucher_value'] = res[0]['credit_voucher_value'] - sum;
                                    res[0]['credit_voucher_value'] = parseFloat(res[0]['credit_voucher_value'].toFixed(2));
                                    // res[0]['credit_voucher_value'] = existing_credit_voucher[existing_credit_voucher.length - 1]['redeem_remaining']
                                }
                                self.redeem_credit_voucher = res[0];
                                $('#lbl_credit_voucher_no').html("Amount: " + self.format_currency(res[0].credit_voucher_value));
                                $('#lbl_voucher_customer').html("Customer: " + res[0].customer_id[1]);
                                if (res[0].credit_voucher_value <= 0) {
                                    $('#redeem_voucher_amount_row').hide();
                                    $('#in_balance').show();
                                } else {
                                    $('#redeem_voucher_amount_row').fadeIn('fast');
                                    $('#text_voucher_redeem_amount').focus();
                                }
                            }
                        } else {
                            alert("Barcode not found Or Credit Voucher has been expired.")
                            $('#text_credit_voucher_no').focus();
                            $('#lbl_credit_voucher_no').html('');
                            $('#lbl_voucher_customer').html('');
                            $('#in_balance').html('');
                        }
                    }, function(type, err) {});
                }
            });
        },
        click_cancel: function() {
            var self = this;
            self._super();
            if (self.payment_self) {
                $('body').keypress(self.payment_self.keyboard_handler);
                $('body').keydown(self.payment_self.keyboard_keydown_handler);
            }
        },
        click_confirm: function() {
            var order = self.pos.get_order();
            var client = order.get_client();
            var due = order.get_due();
            var redeem_amount = this.$('#text_voucher_redeem_amount').val();
            var code = $('#text_credit_voucher_no').val();
            if (self.redeem_credit_voucher.credit_voucher_no) {
                if (code == self.redeem_credit_voucher.credit_voucher_no) {
                    if (!self.redeem_credit_voucher.credit_voucher_value == 0) {
                        if (redeem_amount) {
                            if (redeem_amount <= due) {
                                if (!client) {
                                    order.set_client(self.pos.db.get_partner_by_id(self.redeem_credit_voucher.customer_id[0]));
                                }
                                if (0 < Number(redeem_amount)) {
                                    if (self.redeem_credit_voucher && self.redeem_credit_voucher.credit_voucher_value >= Number(redeem_amount)) {
                                        var vals = {
                                            'redeem_credit_voucher_no': self.redeem_credit_voucher.id,
                                            'redeem_credit_voucher': self.$('#text_credit_voucher_no').val(),
                                            'redeem_credit_voucher_amount': self.$('#text_voucher_redeem_amount').val(),
                                            'redeem_remaining': self.redeem_credit_voucher.credit_voucher_value - self.$('#text_voucher_redeem_amount').val(),
                                            'credit_voucher_customer_id': self.redeem_credit_voucher.customer_id[0] || false,
                                            'customer_name': self.redeem_credit_voucher.customer_id[1],
                                        };
                                        var get_redeem = order.get_redeem_credit_voucher();
                                        if (get_redeem) {
                                            var product = self.pos.db.get_product_by_id(self.pos.config.enable_credit_journal_id)
                                            var cashregisters = null;
                                            if (self.pos.config.enable_credit_journal_id[0]) {
                                                for (var j = 0; j < self.pos.cashregisters.length; j++) {
                                                    if (self.pos.cashregisters[j].journal_id[0] === self.pos.config.enable_credit_journal_id[0]) {
                                                        cashregisters = self.pos.cashregisters[j];
                                                    }
                                                }
                                            }
                                            if (vals) {
                                                if (self.payment_self) {
                                                    $('body').keypress(self.payment_self.keyboard_handler);
                                                    $('body').keydown(self.payment_self.keyboard_keydown_handler);
                                                }
                                                if (cashregisters) {
                                                    var paymentlines = order.get_paymentlines();
                                                    var voucher_paymentline = false;
                                                    var voucher_registers_paymentline = false;
                                                    for (var i = 0; i < paymentlines.length; i++) {
                                                        if (paymentlines[i].cashregister.journal_id[0] === self.pos.config.enable_credit_journal_id[0]) {
                                                            voucher_paymentline = true;
                                                            voucher_registers_paymentline = paymentlines[i];
                                                            break;
                                                        }
                                                    }
                                                    if (!voucher_paymentline) {
                                                        order.add_paymentline(cashregisters);
                                                    } else if (voucher_paymentline) {
                                                        order.select_paymentline(voucher_registers_paymentline);
                                                        self.chrome.screens.payment.reset_input();
                                                        self.chrome.screens.payment.render_paymentlines();
                                                        redeem_amount = order.selected_paymentline.get_amount() + Math.max(redeem_amount);
                                                    }
                                                    order.selected_paymentline.set_amount(Math.max(redeem_amount), 0);
                                                    order.selected_paymentline.set_credit_voucher_redeem_amount(Math.max(redeem_amount), 0);
                                                    order.selected_paymentline.set_credit_voucher_line_code(code);
                                                    order.selected_paymentline.set_payment_redeem_credit_voucher(vals);
                                                    self.chrome.screens.payment.reset_input();
                                                    self.chrome.screens.payment.render_paymentlines();
                                                    order.set_redeem_credit_voucher(vals);
                                                    order.set_total_credit_voucher_redeem_amount(parseFloat(self.$('#text_voucher_redeem_amount').val()));
                                                }
                                            }
                                            this.gui.close_popup();
                                        }
                                    } else {
                                        alert("Please enter amount below credit voucher value.");
                                        $('#text_voucher_redeem_amount').focus();
                                    }
                                } else {
                                    alert("Please enter valid amount.");
                                    $('#text_voucher_redeem_amount').focus();
                                }
                            } else {
                                alert("Credit voucher amount should be less than or equal to due amount");
                            }
                        } else {
                            alert("Please enter amount.");
                            $('#text_voucher_redeem_amount').focus();
                        }
                    }
                } else {
                    alert("Invalid barcode.");
                    $('#text_credit_voucher_no').focus();
                }
            } else {
                alert("Press Enter key.");
                $('#text_credit_voucher_no').focus();
            }
        },
    });
    gui.define_popup({
        name: 'redeem_credit_voucher_popup',
        widget: RedeemCreditvoucherPopupWidget
    });

    var _super_posmodel = models.PosModel;
    models.PosModel = models.PosModel.extend({
        load_server_data: function() {
            var self = this;
            var loaded = _super_posmodel.prototype.load_server_data.call(this);
            var today = moment().format('YYYY-MM-DD');
            return loaded.then(function() {
                return rpc.query({
                    model: "pos.credit.voucher",
                    method: "search_read",
                    args: [
                        [
                            ['is_active', '=', true],
                            ['expire_date', '>=', today]
                        ]
                    ]
                }).then(function(credit_vouchers) {
                    self.db.add_credit_vouchers(credit_vouchers);
                });
            });
        },
        load_new_credit_vouchers: function() {
            var self = this;
            var def = new $.Deferred();
            var fields = [];
            var voucher_write_date = this.db.get_voucher_write_date();
            var domain = [
                ['write_date', '>', this.db.get_voucher_write_date()]
            ];
            if (!voucher_write_date) {
                domain = [];
            }
            rpc.query({
                    model: 'pos.credit.voucher',
                    method: 'search_read',
                    args: [domain, fields],
                }, {
                    shadow: true,
                })
                .then(function(credit_vouchers) {
                    if (self.db.add_credit_vouchers(credit_vouchers)) {
                        def.resolve();
                    } else {
                        def.reject();
                    }
                }, function(err, event) {
                    event.preventDefault();
                    def.reject();
                });
            return def;
        },
    });

    var PosCreditVoucherListButton = screens.ActionButtonWidget.extend({
        template: 'PosCreditVoucherListButton',
        button_click: function() {
            var self = this;
            self.gui.show_screen('creditvoucherlistscreen');
        }
    });

    screens.define_action_button({
        'name': 'pos_credit_voucher_list',
        'widget': PosCreditVoucherListButton,
        'condition': function() {
            return this.pos.config.enable_credit_voucher;
        },
    });

    DB.include({
        init: function(options) {
            this._super.apply(this, arguments);
            this.voucher_write_date = null;
            this.voucher_by_id = {};
            this.voucher_sorted = [];
        },
        add_credit_vouchers: function(credit_vouchers) {
            var updated_count = 0;
            var new_write_date = '';
            for (var i = 0, len = credit_vouchers.length; i < len; i++) {
                var credit_voucher = credit_vouchers[i];
                if (this.voucher_write_date &&
                    this.voucher_by_id[credit_voucher.id] &&
                    new Date(this.voucher_write_date).getTime() + 1000 >=
                    new Date(credit_voucher.write_date).getTime()) {
                    continue;
                } else if (new_write_date < credit_voucher.write_date) {
                    new_write_date = credit_voucher.write_date;
                }
                if (!this.voucher_by_id[credit_voucher.id]) {
                    this.voucher_sorted.push(credit_voucher.id);
                }
                this.voucher_by_id[credit_voucher.id] = credit_voucher;
                updated_count += 1;
            }
            this.voucher_write_date = new_write_date || this.voucher_write_date;
            return updated_count;
        },
        get_voucher_write_date: function() {
            return this.voucher_write_date;
        },
        get_voucher_by_id: function(id) {
            return this.voucher_by_id[id];
        },
        search_credit_vouchers: function(query) {
            var results = [];
            var self = this;
            var def = new $.Deferred();
            ajax.jsonRpc('/web/search_credit_voucher', 'call', {
                'query': query,
                'today': moment().format('YYYY-MM-DD')
            }).done(function(vouchers) {
                var credit_voucher_data_list = [];
                _.map(vouchers, function(voucher) {
                    var credit_voucher = self.get_voucher_by_id(voucher);
                    credit_voucher_data_list.push(credit_voucher);
                })
                def.resolve(credit_voucher_data_list);
            });
            return def
        },
        get_vouchers_sorted: function(max_count) {
            max_count = max_count ? Math.min(this.voucher_sorted.length, max_count) : this.voucher_sorted.length;
            var credit_vouchers = [];
            for (var i = 0; i < max_count; i++) {
                credit_vouchers.push(this.voucher_by_id[this.voucher_sorted[i]]);
            }
            return credit_vouchers;
        },
    });

    var CreditVoucherListScreenWidget = screens.ScreenWidget.extend({
        template: 'CreditVoucherListScreenWidget',
        init: function(parent, options) {
            var self = this;
            this._super(parent, options);
        },
        show: function() {
            this._super();
            this.reload_credit_vouchers();
        },
        start: function() {
            var self = this;
            this._super();
            this.$('.back').click(function() {
                self.gui.back();
            });
            var credit_vouchers = this.pos.db.get_vouchers_sorted(1000);
            this.render_list(credit_vouchers);
            //Print card
            this.$('.creditvoucher-list-contents').off('#print_credit_voucher', 'click')
            this.$('.creditvoucher-list-contents').delegate('#print_credit_voucher', 'click', function(event) {
                var voucher_id = parseInt($(this).data('id'));
                var result = self.pos.db.get_voucher_by_id(voucher_id);
                var credit_voucher_src = false;
                if (result) {
                    var barcode = result.credit_voucher_no;
                    if (barcode) {
                        var barcode_val = barcode.toString();
                        var barcodeTemplate = QWeb.render('credit_voucherbarcode', {
                            widget: this,
                            barcode: barcode_val
                        });
                        $(barcodeTemplate).find('#barcode_credit_voucher').removeClass(barcode.toString());
                        $(barcodeTemplate).find('#barcode_credit_voucher').barcode(barcode_val.toString(), "code128");
                        if (_.isElement($(barcodeTemplate).find('#barcode_credit_voucher').barcode(barcode_val.toString(), "code128")[0])) {
                            if ($(barcodeTemplate).find('#barcode_credit_voucher').barcode(barcode_val.toString(), "code128")[0].firstChild != undefined &&
                                $(barcodeTemplate).find('#barcode_credit_voucher').barcode(barcode_val.toString(), "code128")[0].firstChild.data != undefined) {
                                credit_voucher_src = $(barcodeTemplate).find('#barcode_credit_voucher').barcode(barcode_val.toString(), "code128")[0].firstChild.data;
                            }
                        }
                        var receipt_type = false;
                        var expire_date_format = ""
                        if (result.expire_date) {
                            var expire_date = moment(result.expire_date, 'YYYY-MM-DD');
                            expire_date_format = moment(expire_date).format("DD/MM/YYYY");
                        }
                        var receipt = false;
                        if (!self.pos.config.iface_print_via_proxy) {
                            receipt = QWeb.render('PrintVoucherPosTicket', {
                                widget: self,
                                credit_voucher: result,
                                credit_voucher_src: credit_voucher_src,
                                expire_date_format: expire_date_format
                            });
                            receipt_type = 'normal';
                        } else {
                            receipt = QWeb.render('PrintVoucherXmlReceipt', {
                                widget: self,
                                credit_voucher: result,
                                credit_voucher_src: credit_voucher_src,
                                expire_date_format: expire_date_format
                            });
                            receipt_type = 'xmlReceipt';
                        }
                        self.gui.show_screen('CreditVoucherReceipt', {
                            receipt: receipt,
                            receipt_type: receipt_type
                        });
                    }
                }
            });
            //searchbox
            var search_timeout = null;
            if (this.pos.config.iface_vkeyboard && self.chrome.widget.keyboard) {
                self.chrome.widget.keyboard.connect(this.$('.searchbox.voucher_search input'));
            }
            this.$('.searchbox.voucher_search input').off('keypress').on('keydown', function(event) {
                if (event.which === 13) {
                    clearTimeout(search_timeout);
                    var searchbox = this;
                    search_timeout = setTimeout(function() {
                        self.perform_search(searchbox.value, event.which === 13);
                    }, 70);
                }
            });
            this.$('.searchbox.voucher_search .search-clear').click(function() {
                self.clear_search();
            });
        },
        perform_search: function(query, associate_result) {
            var self = this;
            if (query) {
                self.pos.db.search_credit_vouchers(query).done(function(credit_vouchers) {
                    self.render_list(credit_vouchers);
                });
            } else {
                var credit_vouchers = self.pos.db.get_vouchers_sorted();
                this.render_list(credit_vouchers);
            }
        },
        clear_search: function() {
            var credit_vouchers = this.pos.db.get_vouchers_sorted();
            this.render_list(credit_vouchers);
            this.$('.searchbox.voucher_search input')[0].value = '';
            this.$('.searchbox.voucher_search input').focus();
        },
        render_list: function(credit_vouchers) {
            var self = this;
            var contents = this.$el[0].querySelector('.creditvoucher-list-contents');
            contents.innerHTML = "";
            var temp = [];
            for (var i = 0, len = Math.min(credit_vouchers.length); i < len; i++) {
                var credit_voucher = credit_vouchers[i];
                var today = moment().format('YYYY-MM-DD');
                if (today > credit_voucher.expire_date) {
                    continue;
                }
                credit_voucher.amount = parseFloat(credit_voucher.amount).toFixed(2);
                var expire_date_format = "";
                if (credit_voucher.expire_date) {
                    var expire_date = moment(credit_voucher.expire_date, 'YYYY-MM-DD');
                    expire_date_format = moment(expire_date).format("DD/MM/YYYY");
                }
                var issue_date_format = "";
                if (credit_voucher.issue_date) {
                    var issue_date = moment(credit_voucher.issue_date, 'YYYY-MM-DD');
                    issue_date_format = moment(issue_date).format("DD/MM/YYYY");
                }
                var clientline_html = QWeb.render('CreditVoucherlistLine', {
                    widget: this,
                    credit_voucher: credit_voucher,
                    expire_date_format: expire_date_format,
                    issue_date_format: issue_date_format
                });
                var clientline = document.createElement('tbody');
                clientline.innerHTML = clientline_html;
                clientline = clientline.childNodes[1];
                contents.appendChild(clientline);
            }
        },
        reload_credit_vouchers: function() {
            var self = this;
            return this.pos.load_new_credit_vouchers().then(function() {
                self.render_list(self.pos.db.get_vouchers_sorted(1000));
            });
        },
        close: function() {
            this._super();
            this.$('.searchbox.voucher_search input')[0].value = '';
            if (this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard) {
                this.chrome.widget.keyboard.hide();
            }
        },
    });
    gui.define_screen({
        name: 'creditvoucherlistscreen',
        widget: CreditVoucherListScreenWidget
    });

    var CreditVoucherReceiptScreenWidget = screens.ScreenWidget.extend({
        template: 'CreditVoucherReceiptScreenWidget',
        show: function() {
            this._super();
            var self = this;
            this.render_receipt();
        },
        renderElement: function() {
            var self = this;
            this._super();
            this.$('.next').click(function() {
                self.click_next();
            });
            this.$('.button.print').click(function() {
                self.print();
            });
        },
        click_next: function() {
            this.gui.show_screen('products');
        },
        render_receipt: function() {
            var receipt_type = this.gui.get_current_screen_param('receipt_type');
            var receipt = this.gui.get_current_screen_param('receipt');
            if (receipt_type === 'xmlReceipt') {
                this.pos.proxy.print_receipt(receipt);
                this.click_next();
            } else {
                this.$('.pos-receipt-container').html(receipt);
            }
        },
        print: function() {
            var self = this;
            if (!this.pos.config.iface_print_via_proxy) {
                this.print_web();
            } else {
                this.print_xml();
            }
        },
        print_web: function() {
            if ($.browser.safari) {
                document.execCommand('print', false, null);
            } else {
                try {
                    window.print();
                } catch (err) {
                    if (navigator.userAgent.toLowerCase().indexOf("android") > -1) {
                        this.gui.show_popup('error', {
                            'title': _t('Printing is not supported on some android browsers'),
                            'body': _t('Printing is not supported on some android browsers due to no default printing protocol is available. It is possible to print your tickets by making use of an IoT Box.'),
                        });
                    } else {
                        throw err;
                    }
                }
            }
        },
    });
    gui.define_screen({
        name: 'CreditVoucherReceipt',
        widget: CreditVoucherReceiptScreenWidget
    });

    function zero_pad(num, size) {
        var s = "" + num;
        while (s.length < size) {
            s = "0" + s;
        }
        return s;
    }

});