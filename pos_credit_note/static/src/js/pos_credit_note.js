odoo.define('pos_credit_note.pos_credit_note', function(require) {
    "use strict";

    var core = require('web.core');
    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');
    var utils = require('web.utils');
    var round_pr = utils.round_precision;
    var session = require('web.session');

    var is_pos_loyalty_amount_install = _.contains(session.module_list, 'pos_loyalty_amount');
    var is_pos_credit_voucher_install = _.contains(session.module_list, 'pos_credit_voucher');
    var is_pos_rma_install = _.contains(session.module_list, 'pos_rma');

    var _t = core._t;

    var posmodel_super = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        push_order: function(order, opts) {
            if(order){
                order.get_refund_invoice()
            }
            if(order && order.get_refund_invoice()){
                opts = opts || {};
                var self = this;
                if(order){
                    this.db.add_order(order.export_as_JSON());
                }
                var pushed = new $.Deferred();
                this.flush_mutex.exec(function(){
                    var flushed = self._flush_orders(self.db.get_orders(), opts);
                    flushed.always(function(ids){
                        self.chrome.do_action('point_of_sale.pos_invoice_report',{additional_context:{
                            active_ids:ids,
                        }}).done(function () {
                            pushed.resolve();
                        });
                    });
                    return flushed;
                });
                return pushed;
            }else{
                return posmodel_super.push_order.apply(this, arguments);
            }
        },
    });

    var _super_orderline = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        initialize: function(attr, options) {
            this.zero_charges = false;
            _super_orderline.initialize.call(this, attr, options);
        },
        set_zero_charges: function(val) {
            this.zero_charges = val;
        },
        get_zero_charges: function() {
            return this.zero_charges;
        },
        export_as_JSON: function() {
            var self = this;
            var lines = _super_orderline.export_as_JSON.call(this);
            var new_attr = {
                refund_voucher : this.refund_voucher ? this.refund_voucher : false,
            }
            $.extend(lines, new_attr);
            return lines;
        }
    });

    var _super_order = models.Order.prototype;
    models.Order = models.Order.extend({
        initialize: function() {
            var self = this;
            self.set({
                'refund_invoice': false,
            });
            _super_order.initialize.apply(this, arguments);
        },
        set_refund_invoice: function(refund_invoice) {
            this.set('refund_invoice', refund_invoice);
        },
        get_refund_invoice: function() {
            return this.get('refund_invoice');
        },
        get_subtotal : function(){
            return round_pr(this.orderlines.reduce((function(sum, orderLine){
                if(orderLine.refund_voucher){
                    return sum + 0;
                }else{
                    return sum + orderLine.get_display_price();
                }
            }), 0), this.pos.currency.rounding);
        },
        get_total_without_tax: function() {
            return round_pr(this.orderlines.reduce((function(sum, orderLine) {
                if(orderLine.refund_voucher){
                    return sum + 0;
                }else{
                    return sum + orderLine.get_price_without_tax();
                }
            }), 0), this.pos.currency.rounding);
        },
        get_total_tax: function() {
            return round_pr(this.orderlines.reduce((function(sum, orderLine) {
                if(orderLine.refund_voucher){
                    return sum + 0;
                }else{
                    return sum + orderLine.get_tax();
                }
            }), 0), this.pos.currency.rounding);
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
        get_order_state: function() {
            return this.get('order_state');
        },
        get_vtotal_with_tax: function() {
            return this.get_vtotal_without_tax() + this.get_vtotal_tax();
        },
        get_vtotal_without_tax: function() {
            return round_pr(this.orderlines.reduce((function(sum, orderLine) {
                if(orderLine.refund_voucher){
                    return sum + orderLine.get_price_without_tax();
                }else{
                    return sum + 0;
                }
            }), 0), this.pos.currency.rounding);
        },
        get_vtotal_tax: function() {
            return round_pr(this.orderlines.reduce((function(sum, orderLine) {
                if(orderLine.refund_voucher){
                    return sum + orderLine.get_tax();
                }else{
                    return sum + 0;
                }
            }), 0), this.pos.currency.rounding);
        },
        export_as_JSON: function() {
            var self = this;
            var new_val = {};
            var orders = _super_order.export_as_JSON.call(this);
            var voucher_product_orderLines = [];
            this.orderlines.each(_.bind( function(item) {
                if(item.refund_voucher){
                    var temp_item = item.export_as_JSON();
                    temp_item.price_unit = temp_item.price_unit * -1;
                    temp_item.price_subtotal = temp_item.price_subtotal * -1;
                    temp_item.price_subtotal_incl = temp_item.price_subtotal_incl * -1;
                    return voucher_product_orderLines.push([0, 0, temp_item]);
                }
            }, this));
            new_val = {
                voucher_product_orderLines : voucher_product_orderLines,
                refund_invoice :this.get_refund_invoice() ? true : false,
                is_pos_credit_voucher_install: is_pos_credit_voucher_install,
                vamount_total : this.get_vtotal_with_tax() * -1,
                vamount_tax : this.get_vtotal_tax() * -1,
                amount_tax: this.get_total_tax() - this.get_vtotal_tax(),
                amount_total: this.get_total_with_tax() + this.get_vtotal_with_tax(),
            }
            $.extend(orders, new_val);
            return orders;
        },
        init_from_JSON: function(json) {
            _super_order.init_from_JSON.apply(this, arguments);
            json.refund_invoice = json.refund_invoice;
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
                if(order.get_refund_invoice()){
                    var total_voucher_amount = Math.abs(order.get_due_amount())
                    var voucher_product = self.pos.db.get_product_by_id(self.pos.config.credit_voucher_product[0]);
                    if(!voucher_product){
                        alert(_t("Please configure voucher product."))
                        return false;
                    }
                    var line_dict = {pos: self.pos, order: order, product: voucher_product};
                    var line = new models.Orderline({}, line_dict);
                    line.set_quantity(1);
                    line.set_unit_price(total_voucher_amount);
                    line.refund_voucher = true;
                    line.set_zero_charges(true);
                    order.add_orderline(line);
                }
            }
            if(order.get_refund_invoice()){
                self.finalize_validation2();
            }
        },
        finalize_validation2: function() {
            var self = this;
            var order = this.pos.get_order();
            if (order.is_paid_with_cash() && this.pos.config.iface_cashdrawer) {
                this.pos.proxy.open_cashbox();
            }
            order.initialize_validation_date();
            order.finalized = true;
            if (order.is_to_invoice()) {
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
                        self.gui.show_popup('confirm',{
                            'title': _t('Please print the invoice from the backend'),
                            'body': _t('The order has been synchronized earlier. Please make the invoice from the backend for the order: ') + error.data.order.name,
                            confirm: function () {
                                self.gui.show_screen('receipt');
                            },
                            cancel: function () {
                                self.gui.show_screen('receipt');
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
                this.pos.push_order(order);
                this.gui.show_screen('receipt');
            }
        },
        finalize_validation: function() {
            var self = this;
            var order = this.pos.get_order();
            if(! is_pos_credit_voucher_install &&  ! is_pos_rma_install){
                this._super();
            }else if(order.get_refund_invoice()){
                self.is_credit_voucher();
            }else{
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
                        }else if (error.message === 'Backend Invoice') {
                            self.gui.show_popup('confirm',{
                                'title': _t('Please print the invoice from the backend'),
                                'body': _t('The order has been synchronized earlier. Please make the invoice from the backend for the order: ') + error.data.order.name,
                                confirm: function () {
                                    this.gui.show_screen('receipt');
                                },
                                cancel: function () {
                                    this.gui.show_screen('receipt');
                                },
                            });
                        }  else if (error.code < 0) { // XmlHttpRequest Errors
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
            }
        },
    });

    screens.PaymentScreenWidget.include({
        validate_order: function(force_validation) {
            var self = this;
            var order = self.pos.get_order();
            if(! is_pos_credit_voucher_install 
                    && order.get_order_state() == 'invoiced'){
                order.set_refund_invoice(true);
                this._super(force_validation);
            }else if(order.get_order_state() == 'invoiced'
                && order.get_paymentlines().length > 0
                && order.get_total_paid() != 0){
                order.set_refund_invoice(true);
                this._super(force_validation);
            }else{
                this._super(force_validation);
            }
        }
    });

    function zero_pad(num, size) {
        var s = "" + num;
        while (s.length < size) {
            s = "0" + s;
        }
        return s;
    }

});
