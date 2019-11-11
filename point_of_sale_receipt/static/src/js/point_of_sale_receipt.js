odoo.define("point_of_sale_receipt.point_of_sale_receipt", function(require) {
    "use strict"

    var core = require('web.core');
    var devices = require('point_of_sale.devices');
    var models = require('point_of_sale.models');
    var PosBaseWidget = require('point_of_sale.BaseWidget');
    var rpc = require('web.rpc');
    var utils = require('web.utils');
    var screens = require('point_of_sale.screens');
    var session = require('web.session');

    var round_pr = utils.round_precision;

    var QWeb = core.qweb;
    var _t = core._t;

    models.load_fields('res.company', ['street', 'street2', 'city', 'zip', 'state_id']);
    models.load_fields('res.users', ['ticket_name']);
    models.load_fields('account.tax', ['description']);
    models.load_fields('account.journal', ['print_journal_name']);

    models.PosModel = models.PosModel.extend({
        _save_to_server: function(orders, options) {
            if (!orders || !orders.length) {
                var result = $.Deferred();
                result.resolve([]);
                return result;
            }
            options = options || {};
            var self = this;
            var timeout = typeof options.timeout === 'number' ? 75000000000 * orders.length : 75000000000 * orders.length;
            // Keep the order ids that are about to be sent to the
            // backend. In between create_from_ui and the success callback
            // new orders may have been added to it.
            var order_ids_to_sync = _.pluck(orders, 'id');
            // we try to send the order. shadow prevents a spinner if it takes too long. (unless we are sending an invoice,
            // then we want to notify the user that we are waiting on something )
            var args = [_.map(orders, function(order) {
                order.to_invoice = options.to_invoice || false;
                return order;
            })];
            return rpc.query({
                    model: 'pos.order',
                    method: 'create_from_ui',
                    args: args,
                    kwargs: {
                        context: session.user_context
                    },
                }, {
                    timeout: timeout,
                    shadow: !options.to_invoice
                })
                .then(function(server_ids) {
                    _.each(order_ids_to_sync, function(order_id) {
                        self.db.remove_order(order_id);
                    });
                    self.set('failed', false);
                    return server_ids;
                }).fail(function(type, error) {
                    if (error.code === 200) { // Business Logic Error, not a connection problem
                        //if warning do not need to display traceback!!
                        if (error.data.exception_type == 'warning') {
                            delete error.data.debug;
                        }
                        // Hide error if already shown before ...
                        if ((!self.get('failed') || options.show_error) && !options.to_invoice) {
                            self.gui.show_popup('error-traceback', {
                                'title': error.data.message,
                                'body': error.data.debug
                            });
                        }
                        self.set('failed', error);
                    }
                    console.error('Failed to send orders:', orders);
                });
        },
    });

    PosBaseWidget.include({
        format_currency: function(amount, precision) {
            var currency = (this.pos && this.pos.currency) ? this.pos.currency : {
                symbol: '$',
                position: 'after',
                rounding: 0.01,
                decimals: 2
            };
            amount = this.format_currency_no_symbol(amount, precision);
            if (currency.position === 'after') {
                return amount + '' + (currency.symbol || '');
            } else {
                return (currency.symbol || '') + '' + amount;
            }
        },
    });

    var _super_order = models.Order.prototype;
    models.Order = models.Order.extend({
        initialize: function(attributes, options) {
            var self = this;
            this.set({
                'pos_reference': false
            });
            _super_order.initialize.apply(this, arguments);
        },
        get_new_total: function() {
            var self = this;
            var total_loyalty_used = 0;
            var new_total = this.get_total_with_tax();
            var is_loyalty_payment = false;
            var paymentlines = this.get_paymentlines();
            if (self.reprint_receipt) {
                if (self.reservation_ticket) {
                    paymentlines = this.get_rjournal();
                    _.each(paymentlines, function(paymentline) {
                        if (self.pos.config.enable_loyalty && self.pos.config.loyalty_journal[0] == paymentline.journal_id) {
                            total_loyalty_used = total_loyalty_used + paymentline.amount;
                            is_loyalty_payment = true;
                        }
                    });
                } else {
                    paymentlines = this.get_journal();
                    _.each(paymentlines, function(paymentline) {
                        if (self.pos.config.enable_loyalty && self.pos.config.loyalty_journal[0] == paymentline.journal_id) {
                            total_loyalty_used = total_loyalty_used + paymentline.amount;
                            is_loyalty_payment = true;
                        }
                    });
                }
            } else {
                _.each(paymentlines, function(paymentline) {
                    if (self.pos.config.enable_loyalty && self.pos.config.loyalty_journal[0] == paymentline.cashregister.journal_id[0]) {
                        total_loyalty_used = total_loyalty_used + paymentline.get_amount();
                        is_loyalty_payment = true;
                    }
                });
            }
            if (self.reservation_ticket) {
                new_total = this.get_without_reservation_total_with_tax();
            }
            new_total = new_total - total_loyalty_used;
            var new_total_dict = {
                'is_loyalty_payment': is_loyalty_payment,
                'total_loyalty_used': total_loyalty_used,
                'new_total': new_total
            }
            return new_total_dict;
        },
        get_tax_details: function() {
            var details = {};
            var fulldetails = [];

            this.orderlines.each(function(line) {
                var ldetails = line.get_tax_details();
                for (var id in ldetails) {
                    if (ldetails.hasOwnProperty(id)) {
                        details[id] = (details[id] || 0) + ldetails[id];
                    }
                }
            });

            for (var id in details) {
                if (details.hasOwnProperty(id)) {
                    fulldetails.push({
                        amount: details[id],
                        tax: this.pos.taxes_by_id[id],
                        name: this.pos.taxes_by_id[id].description
                    });
                }
            }

            return fulldetails;
        },
        get_client_ticket_name: function() {
            var client = this.get('client');
            return client ? client.ticket_name : "";
        },
        get_rdue: function(paymentline) {
            if (this.reservation_ticket) {
                if (!paymentline) {
                    var due = this.get_total_with_tax();
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
                return round_pr(Math.max(0, due), this.pos.currency.rounding);
            } else {
                return _super_order.get_due.apply(this, arguments);
            }
        },
        get_discount_amount: function(orderLine) {
            return round_pr((orderLine.get_unit_price() * (orderLine.get_discount() / 100) * orderLine.get_quantity()), this.pos.currency.rounding);
        },
        set_pos_reference: function(pos_reference) {
            this.set('pos_reference', pos_reference);
        },
        get_pos_reference: function() {
            return this.get('pos_reference');
        },
        export_for_printing: function() {
            var json = _super_order.export_for_printing.apply(this, arguments);
            var cashier = this.pos.cashier || this.pos.user;
            var cashier_name = cashier.ticket_name || cashier.name;
            json.company_details = this.pos.company;
            json.date_order = moment(new Date()).format('DD/MM/YYYY');
            json.cashier_name = cashier_name;
            json.company.website = this.pos.company.website.replace('https://', '').replace('http://', '');
            json['shop_address_id'] = {
                name: this.pos.config.shop_name,
                city: this.pos.config.shop_city,
                zip: this.pos.config.shop_zip,
                street: this.pos.config.shop_street,
                street2: this.pos.config.shop_street2,
                logo: 'data:image/png;base64,' + this.pos.config.shop_logo,
                phone: this.pos.config.shop_phone,
                email: this.pos.config.shop_email
            };
            var barcode_val = this.get_name();
            var barcode_src = false;
            if (this.get_pos_reference()) {
                barcode_val = this.get_pos_reference();
            }
            if (barcode_val.indexOf(_t("Order ")) != -1) {
                barcode_val = barcode_val.split(_t("Order "))[1];
                var barcodeTemplate = QWeb.render('templatebarcode', {
                    widget: self,
                    barcode: barcode_val
                });
                $(barcodeTemplate).find('#barcode_div').barcode(barcode_val.toString(), "code128");
                if (_.isElement($(barcodeTemplate).find('#barcode_div').barcode(barcode_val.toString(), "code128")[0])) {
                    if ($(barcodeTemplate).find('#barcode_div').barcode(barcode_val.toString(), "code128")[0].firstChild != undefined &&
                        $(barcodeTemplate).find('#barcode_div').barcode(barcode_val.toString(), "code128")[0].firstChild.data != undefined) {
                        barcode_src = $(barcodeTemplate).find('#barcode_div').barcode(barcode_val.toString(), "code128")[0].firstChild.data;
                    }
                }
            }
            json.barcode_src = barcode_src;
            json.barcode_val = barcode_val;
            return json;
        },
    });

    function space_pad(num, size) {
        var s = "" + num;
        while (s.length < size) {
            s = s + " ";
        }
        return s;
    }

    var _super_order_line = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        initialize: function(attr, options) {
            this.zero_charges = false;
            _super_order_line.initialize.call(this, attr, options);
        },
        generate_wrapped_orderline_product_name: function() {

            //For Order line product name wrapped
            var MAX_LENGTH = 24; // 40 * line ratio of .6
            var wrapped = [];
            var name = this.get_product().display_name;
            var current_line = "";

            while (name.length > 0) {
                var space_index = 23; //name.indexOf(" ");

                if (space_index === -1) {
                    space_index = name.length;
                }

                if (current_line.length + space_index > MAX_LENGTH) {
                    if (current_line.length) {
                        wrapped.push(current_line);
                    }
                    current_line = "";
                }

                current_line += name.slice(0, space_index + 1);
                name = name.slice(space_index + 1);
            }

            if (current_line.length) {
                wrapped.push(current_line);
            }

            return wrapped;
        },
        generate_wrapped_orderline_attributes: function() {

            //For Order line product name wrapped
            var MAX_LENGTH = 22; // 40 * line ratio of .6
            var wrapped = [];


            //For product note
            if (this.remark && this.get_remark()) {
                if (this.get_remark().length > 0) {
                    wrapped.push("Remark: ")
                    var order_line_remark = this.get_remark();
                    var current_order_line_remark = "";

                    while (order_line_remark.length > 0) {
                        var comment_space_index = 21; //name.indexOf(" ");

                        if (comment_space_index === -1) {
                            comment_space_index = order_line_remark.length;
                        }

                        if (current_order_line_remark.length + comment_space_index > MAX_LENGTH) {
                            if (current_order_line_remark.length) {
                                wrapped.push(current_order_line_remark);
                            }
                            current_order_line_remark = "";
                        }

                        current_order_line_remark += order_line_remark.slice(0, comment_space_index + 1);
                        order_line_remark = order_line_remark.slice(comment_space_index + 1);
                    }

                    if (current_order_line_remark.length) {
                        wrapped.push(current_order_line_remark);
                    }
                }
            }

            //For orderline unit name
            if (this.quantity) {
                var order_line_unit_comment = this.quantity + " ";
                order_line_unit_comment = order_line_unit_comment + this.get_unit().name + " at ";
                if (this.order && this.order.reservation_ticket) {
                    order_line_unit_comment = order_line_unit_comment + this.pos.chrome.format_currency(this.price * -1).toString();
                } else {
                    order_line_unit_comment = order_line_unit_comment + this.pos.chrome.format_currency(this.price).toString();
                }
                var current_order_line_unit_comment = "";

                while (order_line_unit_comment.length > 0) {
                    var comment_space_index = 23; //name.indexOf(" ");

                    if (comment_space_index === -1) {
                        comment_space_index = order_line_unit_comment.length;
                    }

                    if (current_order_line_unit_comment.length + comment_space_index > MAX_LENGTH) {
                        if (current_order_line_unit_comment.length) {
                            wrapped.push(current_order_line_unit_comment);
                        }
                        current_order_line_unit_comment = "";
                    }

                    current_order_line_unit_comment += order_line_unit_comment.slice(0, comment_space_index + 1);
                    order_line_unit_comment = order_line_unit_comment.slice(comment_space_index + 1);
                }

                if (current_order_line_unit_comment.length) {
                    wrapped.push(current_order_line_unit_comment);
                }
            }

            if (this.discount) {
                var order_line_discount = "Discount: " + this.pos.chrome.format_currency(this.order.get_discount_amount(this)).toString() + "(" + this.discount.toString() + "%)";
                var current_order_line_discount = "";

                while (order_line_discount.length > 0) {
                    var comment_space_index = 23; //name.indexOf(" ");

                    if (comment_space_index === -1) {
                        comment_space_index = order_line_discount.length;
                    }

                    if (current_order_line_discount.length + comment_space_index > MAX_LENGTH) {
                        if (current_order_line_discount.length) {
                            wrapped.push(current_order_line_discount);
                        }
                        current_order_line_discount = "";
                    }

                    current_order_line_discount += order_line_discount.slice(0, comment_space_index + 1);
                    order_line_discount = order_line_discount.slice(comment_space_index + 1);
                }

                if (current_order_line_discount.length) {
                    wrapped.push(current_order_line_discount);
                }
            }
            return wrapped;
        },
    });

    var _super_paymentline = models.Paymentline.prototype;
    models.Paymentline = models.Paymentline.extend({
        initialize: function(attributes, options) {
            var self = this;
            _super_paymentline.initialize.apply(this, arguments);
            this.print_journal_name = (this.cashregister && this.cashregister.journal) ? this.cashregister.journal.print_journal_name : "";
        },
    });

    devices.ProxyDevice.include({
        print_sale_details: function() {
            var self = this;
            var report_saledetails_args = self.pos.pos_session.id;
            rpc.query({
                    model: 'report.point_of_sale.report_saledetails',
                    method: 'get_current_session_sale_details',
                    args: [report_saledetails_args],
                })
                .then(function(result) {
                    var env = {
                        widget: new PosBaseWidget(self),
                        company: self.pos.company,
                        pos: self.pos,
                        products: result.products,
                        payments: result.payments,
                        taxes: result.taxes,
                        total_paid: result.total_paid,
                        date: (new Date()).toLocaleString(),
                    };
                    var report = QWeb.render('SaleDetailsReport', env);
                    self.print_receipt(report);
                });
        },
    });

    screens.ActionpadWidget.include({
        process_pay_order: function(order) {
            var self = this;
            var has_valid_product_lot = _.every(order.orderlines.models, function(line) {
                return line.has_valid_product_lot();
            });
            if (!has_valid_product_lot) {
                self.gui.show_popup('confirm', {
                    'title': _t('Empty Serial/Lot Number'),
                    'body': _t('One or more product(s) required serial/lot number.'),
                    confirm: function() {
                        self.gui.show_screen('payment');
                    },
                });
            } else {
                self.pos.gui.select_user({
                    'security': true,
                    'current_user': null,
                    'title': _t('Change Cashier'),
                }).then(function(user) {
                    self.pos.set_cashier(user);
                    self.chrome.widget.username.renderElement();
                    self.gui.show_screen('payment');
                });
            }
        },
        renderElement: function() {
            var self = this;
            this._super();
            this.$('.pay').off('click').on('click', function() {
                var order = self.pos.get_order();
                var flag = false;
                if (order.is_empty()) {
                    self.gui.show_popup('error', {
                        'title': _t('Empty Order'),
                        'body': _t('There must be at least one product in your order before it can be validated'),
                    });
                    return false;
                }
                _.each(order.get_orderlines(), function(line) {
                    if (line.get_quantity() == 0 || line.get_unit_price() == 0) {
                        flag = true;
                    }
                });
                if (flag) {
                    self.gui.show_popup('confirm', {
                        'title': _t('Products with zero amount or quantity zero ?'),
                        'body': _t('Proceed Yes / No'),
                        confirm: function() {
                            self.process_pay_order(order);
                        },
                    });
                    return false;
                }
                self.process_pay_order(order);
            });
        }
    });

});