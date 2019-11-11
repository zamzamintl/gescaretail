odoo.define('pos_loyalty_amount.pos_loyalty_amount', function(require) {
    "use strict";

    var core = require('web.core');
    var gui = require('point_of_sale.gui');
    var rpc = require('web.rpc');
    var models = require('point_of_sale.models');
    var PopupWidget = require('point_of_sale.popups');
    var utils = require('web.utils');
    var screens = require('point_of_sale.screens');
    var session = require('web.session');

    var round_di = utils.round_decimals;
    var round_pr = utils.round_precision;

    var QWeb = core.qweb;
    var _t = core._t;

    var is_pos_gift_card_install = _.contains(session.module_list, 'pos_gift_card');
    var is_pos_credit_voucher_install = _.contains(session.module_list, 'pos_credit_voucher');
    var is_pos_reservation_install = _.contains(session.module_list, 'pos_reservation');

    models.load_fields("res.company", ['loyalty_percentage']);
    models.load_fields("res.partner", ['loyalty_amounts']);
    models.load_fields("account.journal", ['is_loyalty_journal']);
    models.load_fields("product.product", ['ignor_for_loyalty']);

    var _super_order = models.Order.prototype;
    models.Order = models.Order.extend({
        initialize: function(attributes, options) {
            this.redeem_loyalty_amount = 0;
            this.won_loyalty_amounts = 0;
            this.total_loyalty_amounts = 0;
            _super_order.initialize.apply(this, arguments);
            this.apply_loyalty = false;
        },
        init_from_JSON: function(json) {
            _super_order.init_from_JSON.apply(this, arguments);
            if (json.redeem_loyalty_amount) {
                this.set_redeem_loyalty_amount(json.redeem_loyalty_amount);
            }
        },
        set_client: function(client) {
            var self = this;
            if (client) {
                if (!client.loyalty_amounts) {
                    client.loyalty_amounts = 0.0;
                }
            }
            _super_order.set_client.apply(this, arguments);
        },
        set_apply_loyalty: function(loyalty) {
            this.apply_loyalty = loyalty;
            this.trigger('change', this);
        },
        loyalty_apply: function(loyalty) {
            return this.apply_loyalty;
        },
        remove_paymentline: function(line) {
            if (line && line.is_loyalty_payment_line()) {
                this.set_redeem_loyalty_amount(-line.get_loyalty_redeem_amount());
            }
            _super_order.remove_paymentline.apply(this, arguments);
        },
        set_redeem_loyalty_amount: function(redeem_loyalty_amount) {
            this.redeem_loyalty_amount = this.redeem_loyalty_amount + redeem_loyalty_amount;
            this.trigger('change', this);
        },
        get_redeem_loyalty_amount: function() {
            return this.redeem_loyalty_amount;
        },
        is_ignore_prod: function(prod_id) {
            var self = this;
            var product = self.pos.db.get_product_by_id(prod_id);
            if (self.pos.config.refund_amount_product_id && self.pos.config.refund_amount_product_id[0] == prod_id) {
                return true;
            } else if (self.pos.config.prod_for_payment && self.pos.config.prod_for_payment[0] == prod_id) {
                return true;
            } else if (self.pos.config.cancellation_charges_product_id && self.pos.config.cancellation_charges_product_id[0] == prod_id) {
                return true;
            } else if (self.pos.config.discount_product_id && self.pos.config.discount_product_id[0] == prod_id) {
                return true;
            } else if (self.pos.config.credit_voucher_product && self.pos.config.credit_voucher_product[0] == prod_id) {
                return true;
            } else {
                return false;
            }
        },
        getTotalTaxIncluded_and_ExcludedIgnoreProduct: function() {
            return this.getTotalExcludedTax_and_ExcludedIgnoreProduct() + this.get_total_tax_and_ExcludedIgnoreProduct();
        },
        get_total_tax_and_ExcludedIgnoreProduct: function() {
            var self = this;
            return round_pr(this.orderlines.reduce((function(sum, orderLine) {
                if (self.is_ignore_prod(orderLine.product.id) || orderLine.get_discount() > 0 ||
                    orderLine.product.ignor_for_loyalty) {
                    return sum + 0;
                } else {
                    return sum + orderLine.get_tax();
                }
            }), 0), self.pos.currency.rounding);
        },
        getTotalExcludedTax_and_ExcludedIgnoreProduct: function() {
            var self = this;
            return round_pr(self.orderlines.reduce((function(sum, orderLine) {
                if (self.is_ignore_prod(orderLine.product.id) || orderLine.get_discount() > 0 ||
                    orderLine.product.ignor_for_loyalty) {
                    return sum + 0;
                } else {
                    return sum + orderLine.get_price_without_tax();
                }
            }), 0), self.pos.currency.rounding);
        },
        get_won_loyalty_amounts: function() {
            var self = this;
            //            if (!this.get_client() || this.get_redeem_loyalty_amount() != 0 || ! this.loyalty_apply()) {
            //                return 0;
            //            }
            if (!this.get_client() || !this.loyalty_apply() || !this.pos.config.enable_loyalty) {
                return 0;
            }
            var maximum_loyalty = self.getTotalTaxIncluded_and_ExcludedIgnoreProduct();
            maximum_loyalty = parseFloat(maximum_loyalty.toFixed(2));
            var total_order_amount = self.get_total_with_tax();
            var total_amounts = total_order_amount - self.get_redeem_loyalty_amount();
            total_amounts = parseFloat(total_amounts.toFixed(2));
            if (is_pos_gift_card_install) {
                total_amounts = total_amounts - self.get_total_gift_card_redeem_amount();
            }
            if (is_pos_credit_voucher_install) {
                _.each(self.get_credit_voucher(), function(voucher) {
                    total_amounts = total_amounts + parseFloat(voucher['credit_voucher_amount'].toFixed(2));
                });
                total_amounts = total_amounts - self.get_total_credit_voucher_redeem_amount();
            }
            if (is_pos_reservation_install && self.get_amount_paid()) {
                total_amounts = total_amounts + self.get_amount_paid();
            }
            if (total_amounts > 0 && (total_amounts >= maximum_loyalty || maximum_loyalty == self.get_redeem_loyalty_amount())) {
                maximum_loyalty = maximum_loyalty - self.get_redeem_loyalty_amount();
                total_amounts = maximum_loyalty;
            }
            total_amounts = (total_amounts * self.pos.company.loyalty_percentage) / 100;
            total_amounts = parseFloat(total_amounts.toFixed(2));
            /*For rma*/
            //            if(total_amounts < 0){
            //                total_amounts = 0;
            //            }
            this.won_loyalty_amounts = total_amounts;
            return total_amounts;
        },
        get_total_loyalty_amounts: function() {
            if (!this.get_client() || !this.pos.config.enable_loyalty) {
                return 0;
            } else {
                var total_loyalty_amounts = this.get_client().loyalty_amounts + this.get_won_loyalty_amounts();
                if (this.get_redeem_loyalty_amount() != 0) {
                    //  total_loyalty_amounts = this.get_client().loyalty_amounts - this.get_redeem_loyalty_amount();
                    total_loyalty_amounts = total_loyalty_amounts - this.get_redeem_loyalty_amount();
                }
                //                if(total_loyalty_amounts < 0){
                //                    total_loyalty_amounts = 0;
                //                }
                this.total_loyalty_amounts = total_loyalty_amounts;
                return total_loyalty_amounts;
            }
        },
        finalize: function() {
            var client = this.get_client();
            var self = this;
            if (client) {
                client.loyalty_amounts = this.get_total_loyalty_amounts();
                this.pos.gui.screen_instances.clientlist.partner_cache.clear_node(client.id);
            }
            _super_order.finalize.apply(this, arguments);
        },
        export_for_printing: function() {
            var json = _super_order.export_for_printing.apply(this, arguments);
            if (this.get_client()) {
                json.loyalty = {
                    won_loyalty_amounts: this.get_won_loyalty_amounts(),
                    redeem_loyalty_amount: this.get_redeem_loyalty_amount(),
                    total_loyalty_amounts: this.get_total_loyalty_amounts(),
                };
            }
            return json;
        },
        export_as_JSON: function() {
            var json = _super_order.export_as_JSON.apply(this, arguments);
            json.won_loyalty_amounts = this.get_won_loyalty_amounts();
            json.redeem_loyalty_amount = this.get_redeem_loyalty_amount();
            return json;
        },
    });

    var _super_paymentline = models.Paymentline.prototype;
    models.Paymentline = models.Paymentline.extend({
        initialize: function(attributes, options) {
            var self = this;
            this.loyalty_payment_line = false;
            this.loyalty_redeem_amount = 0;
            _super_paymentline.initialize.apply(this, arguments);
        },
        init_from_JSON: function(json) {
            _super_paymentline.init_from_JSON.apply(this, arguments);
            this.loyalty_redeem_amount = json.loyalty_redeem_amount;
            if (json.loyalty_payment_line) {
                this.set_is_loyalty_payment_line(json.loyalty_payment_line);
            }
        },
        export_as_JSON: function() {
            var json = _super_paymentline.export_as_JSON.apply(this, arguments);
            json.loyalty_payment_line = this.is_loyalty_payment_line();
            json.loyalty_redeem_amount = this.get_loyalty_redeem_amount();
            return json;
        },
        set_loyalty_redeem_amount: function(value) {
            this.loyalty_redeem_amount = round_di(parseFloat(value) || 0, this.pos.currency.decimals);
            this.trigger('change', this);
        },
        get_loyalty_redeem_amount: function() {
            return this.loyalty_redeem_amount;
        },
        set_is_loyalty_payment_line: function(loyalty_payment_line) {
            this.loyalty_payment_line = loyalty_payment_line;
            this.trigger('change', this);
        },
        is_loyalty_payment_line: function() {
            return this.loyalty_payment_line;
        },
    });

    /* REDEEMPOINT POPUP */
    var RedeemPointPopup = PopupWidget.extend({
        template: 'RedeemPointPopup',
        show: function(options) {
            var self = this;
            this._super();
            self.redeem = false;
            var order = self.pos.get_order();
            window.document.body.removeEventListener('keypress', self.pos.chrome.screens.payment.keyboard_handler);
            window.document.body.removeEventListener('keydown', self.pos.chrome.screens.payment.keyboard_keydown_handler);
            this.renderElement();
            var result = options.result || false;
            $("#redeem_barcode_amt").keypress(function(e) {
                if (e.which != 8 && e.which != 0 && (e.which < 48 || e.which > 57) && e.which != 46) {
                    return false;
                }
            });
            if (result && result[0]) {
                var redeem_loyalty_amount = order.get_redeem_loyalty_amount();
                if (redeem_loyalty_amount > 0) {
                    result[0]['loyalty_amounts'] = result[0]['loyalty_amounts'] - redeem_loyalty_amount;
                }
                result[0]['loyalty_amounts'] = round_di(result[0]['loyalty_amounts'], 2);
                self.redeem = result[0];
                $('.remain_redeem_input').text(self.format_currency(self.redeem.loyalty_amounts));
            }
        },
        click_confirm: function() {
            var self = this;
            var order = self.pos.get_order();
            var client = order.get_client();
            var redeem_amount = this.$("input#redeem_barcode_amt").val();
            var due = order.get_due();
            if (!self.redeem.loyalty_amounts == 0) {
                if (redeem_amount) {
                    redeem_amount = Number(redeem_amount);
                    var maximum_loyalty = order.getTotalTaxIncluded_and_ExcludedIgnoreProduct();
                    maximum_loyalty = maximum_loyalty - order.get_redeem_loyalty_amount();
                    if (maximum_loyalty == 0) {
                        alert(_t("You can't use more loyalty amount"));
                        return true;
                    } else if (maximum_loyalty < redeem_amount) {
                        alert(_t("Please Enter Amount less than or equal to " + maximum_loyalty.toString()));
                        return true;
                    }
                    if (redeem_amount <= due) {
                        if (0 < Number(redeem_amount)) {
                            if (self.redeem && self.redeem.loyalty_amounts >= Number(redeem_amount)) {
                                var remaning_amount = self.redeem.loyalty_amounts - redeem_amount;
                                var cashregisters = null;
                                if (self.pos.config.enable_loyalty) {
                                    for (var j = 0; j < self.pos.cashregisters.length; j++) {
                                        if (self.pos.cashregisters[j].journal_id[0] === self.pos.config.loyalty_journal[0]) {
                                            cashregisters = self.pos.cashregisters[j];
                                        }
                                    }
                                }
                                if (cashregisters) {
                                    order.add_paymentline(cashregisters);
                                    order.selected_paymentline.set_amount(Math.max(redeem_amount), 0);
                                    order.selected_paymentline.set_loyalty_redeem_amount(Math.max(redeem_amount), 0);
                                    order.selected_paymentline.set_is_loyalty_payment_line(true);
                                    self.chrome.screens.payment.reset_input();
                                    self.chrome.screens.payment.render_paymentlines();
                                    order.set_redeem_loyalty_amount(redeem_amount);
                                }
                                window.document.body.addEventListener('keypress', self.pos.chrome.screens.payment.keyboard_handler);
                                window.document.body.addEventListener('keydown', self.pos.chrome.screens.payment.keyboard_keydown_handler);
                                this.gui.close_popup();
                            } else {
                                alert("Please enter amount below saved amount.");
                                $('input#redeem_barcode_amt').focus();
                            }
                        } else {
                            alert("Please enter valid amount.");
                            $('input#redeem_barcode_amt').focus();
                        }
                    } else {
                        alert("Amount should be less than or equal to due amount");
                    }

                } else {
                    alert("Please enter amount.");
                    $('input#redeem_barcode_amt').focus();
                }
            }
        },
        click_cancel: function() {
            var self = this;
            window.document.body.addEventListener('keypress', self.pos.chrome.screens.payment.keyboard_handler);
            window.document.body.addEventListener('keydown', self.pos.chrome.screens.payment.keyboard_keydown_handler);
            this.gui.close_popup();
        },
    });
    gui.define_popup({
        name: 'redeem_point_popup',
        widget: RedeemPointPopup
    });

    screens.PaymentScreenWidget.include({
        init: function(parent, options) {
            var self = this;
            this._super(parent, options);
        },
        validate_order: function(force_validation) {
            var order = this.pos.get_order();
            order.set_apply_loyalty(true);
            this._super(force_validation);
        },
        order_changes: function() {
            this._super();
            var order = this.pos.get_order();
            if (!order) {
                return;
            }
            var redeem_loyalty_amount = order.get_redeem_loyalty_amount();
            if (order.get_client()) {
                var loyalty_amounts = order.get_client()['loyalty_amounts'] - redeem_loyalty_amount;
                this.$(".client_loyalty_amounts").text(this.format_currency(loyalty_amounts));
                if (loyalty_amounts > 0) {
                    this.$('.js_redeem').addClass('highlight')
                } else {
                    this.$('.js_redeem').removeClass('highlight')
                }
            } else {
                this.$(".client_loyalty_amounts").text('0');
                this.$('.js_redeem').removeClass('highlight')
            }
        },
        add_redeem_point: function() {
            var self = this;
            var client_id = self.pos.get_order().get_client();
            if (!client_id) {
                alert(_t('Customer is not selected.'));
            } else {
                rpc.query({
                        model: 'res.partner',
                        method: 'search_read',
                        args: [
                            [
                                ['id', '=', client_id.id]
                            ],
                            ['id', 'loyalty_amounts']
                        ],
                    })
                    .then(function(result) {
                        if (result && result[0]) {
                            if (result[0].loyalty_amounts > 0) {
                                self.gui.show_popup('redeem_point_popup', {
                                    result: result
                                });
                            } else {
                                alert(_t("There is no points for this customer"));
                            }
                        }
                    });
            }
        },
        payment_input: function(input) {
            var self = this;

            var order = this.pos.get_order();
            if (order.selected_paymentline) {
                var line = order.selected_paymentline
                if (line.is_loyalty_payment_line()) {
                    return;
                }
            }

            this._super(input);
        },
        renderElement: function() {
            var self = this;
            self._super();
            this.$('.js_redeem').click(function() {
                var maximum_loyalty = self.pos.get_order().getTotalTaxIncluded_and_ExcludedIgnoreProduct();
                if (maximum_loyalty == 0) {
                    alert(_t("You can't use loyalty amount for pay discount product."));
                } else {
                    self.add_redeem_point();
                }
            });
            _.each(self.pos.cashregisters, function(cashregister) {
                if (cashregister.journal.is_loyalty_journal) {
                    self.$('.paymentmethod[data-id="' + cashregister.journal_id[0] + '"]').remove();
                }
            });
        },
    });

});