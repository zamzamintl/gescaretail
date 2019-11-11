odoo.define('pos_order_history.pos_order_history', function(require) {
    "use strict"

    var core = require('web.core');
    var DB = require('point_of_sale.DB');
    var gui = require('point_of_sale.gui');
    var models = require('point_of_sale.models');
    var PopupWidget = require('point_of_sale.popups');
    var rpc = require('web.rpc');
    var screens = require('point_of_sale.screens');
    var session = require('web.session');

    var QWeb = core.qweb;
    var _t = core._t;

    var is_pos_reservation_install = _.contains(session.module_list, 'pos_reservation');
    var is_pos_copy_ticket_number_install = _.contains(session.module_list, 'pos_copy_ticket_number');

    var OrderHistoryButton = screens.ActionButtonWidget.extend({
        template: "OrderHistoryButton",
        button_click: function() {
            var self = this;
            self.gui.show_popup('Order_History', {
                'title': 'History'
            });
        }
    });
    screens.define_action_button({
        'name': 'OrderHistory',
        'widget': OrderHistoryButton,
    });

    var OrderHistoryPopupWidget = PopupWidget.extend({
        template: 'OrderHistoryPopupWidget',
        show: function(options) {
            options = options || {};
            var self = this;
            this._super();
            this.title = options.title;
            this.renderElement();
            this.$('.footer .ok').click(function() {
                if ($("#receipt_ref_txt").val().length == 0) {
                    var message = _t("Receipt Reference is Empty,Please Enter Receipt Reference Number");
                    alert(message);
                    return false;
                } else {
                    self.gui.close_popup();
                    var iptxtval = $("#receipt_ref_txt").val().toString();
                    if (iptxtval.indexOf('Order') == -1) {
                        iptxtval = _t('Order ') + iptxtval.toString();
                    }
                    self.gui.show_screen('orderlist', {
                        'receipt_ref': iptxtval
                    });
                }
            });
            if (!self.pos.config.iface_vkeyboard) {
                $('#receipt_ref_txt').focus();
            }
            if (this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard) {
                this.chrome.widget.keyboard.connect($('#receipt_ref_txt'));
            }
            this.$('.footer .close').click(function() {
                self.gui.close_popup();
            });
            if (is_pos_copy_ticket_number_install) {
                this.$('.footer .paste').click(function() {
                    var ref = localStorage.getItem('copy_number');
                    $('#receipt_ref_txt').val(ref);
                    $('#receipt_ref_txt').focus();
                });
            } else {
                this.$('.footer .paste').hide();
            }
            self.hotkey_handler = function(event) {
                if (event.which === 13) {
                    self.$('.footer .ok').click();
                } else if (event.which === 27) {
                    self.gui.close_popup();
                }
            };
            $('body').on('keyup', self.hotkey_handler);
        },
        close: function() {
            this._super();
            $('body').off('keyup', this.hotkey_handler);
            if (this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard) {
                this.chrome.widget.keyboard.hide();
                this.chrome.widget.keyboard.connect($('.searchbox input'));
            }
        },
    });
    gui.define_popup({
        name: 'Order_History',
        widget: OrderHistoryPopupWidget
    });

    var OrderListScreenWidget = screens.ScreenWidget.extend({
        template: 'OrderListScreenWidget',
        init: function(parent, options) {
            var self = this;
            this._super(parent, options);
        },
        filter: "all",
        date: "all",
        start: function() {
            var self = this;
            this._super();
            this.$('.back').click(function() {
                self.gui.show_screen('products');
            });
            var orders = self.pos.get('pos_print_order_list');
            this.render_list(orders);
            //print order btn
            var selectedOrder;
            this.$('.order-list-contents').delegate('#print_order', 'click', function(event, p1) {
                var order_id;
                if (p1) {
                    order_id = parseInt(p1.data);
                } else {
                    order_id = parseInt($(this).data('id'));
                }
                var result = self.pos.db.get_order_by_id(order_id);
                selectedOrder = self.pos.get_order();
                var currentOrderLines = selectedOrder.get_orderlines();
                if (currentOrderLines.length > 0) {
                    selectedOrder.set_order_id('');
                    for (var i = 0; i <= currentOrderLines.length + 1; i++) {
                        _.each(currentOrderLines, function(item) {
                            selectedOrder.remove_orderline(item);
                        });
                    }
                    selectedOrder.set_client(null);
                }
                if (result && result.lines.length > 0) {
                    var partner = null;
                    if (result.partner_id && result.partner_id[0]) {
                        partner = self.pos.db.get_partner_by_id(result.partner_id[0])
                    }
                    if (result.order_discount) {
                        selectedOrder.set_order_discount(result.order_discount);
                    }
                    if (result.delivery_date) {
                        selectedOrder.set_reserved_delivery_date(result.delivery_date);
                    }
                    if (result.internal_reservation) {
                        selectedOrder.set_is_internal_reservation(result.internal_reservation);
                    }
                    if (result.reserved) {
                        selectedOrder.set_reservation_mode(result.reserved);
                    }
                    if (result.won_loyalty_amounts) {
                        selectedOrder.set_print_won_amount(result.won_loyalty_amounts);
                    }
                    if (result.redeem_loyalty_amount) {
                        selectedOrder.set_print_redeem_amount(result.redeem_loyalty_amount);
                    }
                    var shop_id = false;
                    if (result.shop_id) {
                        shop_id = result.shop_id[0];
                    }
                    selectedOrder.set_reprint_receipt(true);
                    if (result.total_advance_pay && result.state == 'draft') {
                        selectedOrder.set_amount_paid(result.total_advance_pay);
                    } else {
                        selectedOrder.set_amount_paid(result.amount_paid);
                    }
                    if (result.total_amount && result.state == 'draft') {
                        selectedOrder.set_amount_total(result.total_amount);
                        //selectedOrder.set_amount_total(result.total_amount - result.amount_paid);
                    } else {
                        selectedOrder.set_amount_total(result.amount_total);
                    }
                    var sale_user_id = result.sale_user_id ? result.sale_user_id : false
                    if(sale_user_id){
                        if(sale_user_id[0]){
                            selectedOrder.set('sale_user_id', sale_user_id[0])
                        }
                        if(sale_user_id[1]){
                            selectedOrder.set('sale_user', sale_user_id[1])
                        }
                    }
                    selectedOrder.set_amount_return(Math.abs(result.amount_return));
                    selectedOrder.set_amount_tax(result.amount_tax);
                    selectedOrder.set_company_id(result.company_id[1]);
                    selectedOrder.set_date_order(result.date_order);
                    selectedOrder.set_client(partner);
                    selectedOrder.set_pos_reference(result.pos_reference);
                    selectedOrder.set_user_name(result.user_id && result.user_id[1]);
                    var statement_ids = [];
                    var st_domain = [
                        ['id', 'in', result.statement_ids]
                    ];
                    var line_domain = [
                        ['id', 'in', result.lines]
                    ];
                    var count = 0;
                    rpc.query({
                        model: "pos.order",
                        method: "get_order_history_data",
                        args: [{
                            'st_domain': st_domain,
                            'line_domain': line_domain,
                            'shop_id': shop_id,
                            'order_id': order_id,
                            'is_pos_reservation_install': is_pos_reservation_install
                        }]
                    }).then(function(history_data) {
                        var st = history_data[0];
                        var r = history_data[1];
                        var shop = history_data[2];
                        var reservation_statement = history_data[3];
                        var flag = false;
                        selectedOrder.set_shop_details(shop);
                        if (is_pos_reservation_install && reservation_statement && reservation_statement.length > 0) {
                            selectedOrder.set_rjournal(reservation_statement);
                            flag = true;
                        }
                        if (result.statement_ids) {
                            if (st) {
                                _.each(st, function(st_res) {
                                    var pymnt = {};
                                    pymnt['amount'] = st_res.amount;
                                    pymnt['journal'] = st_res.journal_id[1];
                                    pymnt['journal_id'] = st_res.journal_id[0];
                                    pymnt['print_journal_name'] = st_res.print_journal_name;
                                    statement_ids.push(pymnt);
                                });
                            }
                            selectedOrder.set_journal(statement_ids);
                        }
                        if (r) {
                            _.each(r, function(res) {
                                count += 1;
                                var product = self.pos.db.get_product_by_id(Number(res.product_id[0]));
                                if (product) {
                                    var line_dict = {
                                        pos: self.pos,
                                        order: selectedOrder,
                                        product: product
                                    };
                                    var line = new models.Orderline({}, line_dict);
                                    if (res.advance_pay && flag) {
                                        line.advance_pay = true;
                                        selectedOrder.reservation_ticket = true;
                                    }
                                    if (res.over_all_discount) {
                                        line.set_over_all_discount(res.over_all_discount);
                                    }
                                    line.set_discount(res.discount);
                                    line.set_quantity(res.qty);
                                    line.set_unit_price(res.price_unit);
                                    if (res.remark) {
                                        line.set_remark(res.remark);
                                    }
                                    line.set_line_remark(res.remark);
                                    selectedOrder.add_orderline(line);
                                }
                            });
                            if (count == (result.lines).length) {
                                if (self.pos.config.iface_print_via_proxy) {
                                    var receipt = selectedOrder.export_for_printing();
                                    var env = {
                                        widget: self,
                                        pos: self.pos,
                                        order: selectedOrder,
                                        receipt: receipt,
                                        orderlines: selectedOrder.get_orderlines(),
                                        paymentlines: selectedOrder.get_paymentlines()
                                    };
                                    self.pos.proxy.print_receipt(QWeb.render('RePrintXmlReceipt', env));
                                    self.pos.get('selectedOrder').destroy(); //finish order and go back to scan screen
                                } else {
                                    self.gui.show_screen('receipt');
                                }
                            }
                        }
                    }, function(type, err) {});
                    selectedOrder.set_order_id(order_id);
                }
            });
        },
        show: function() {
            this._super();
            this.reloading_orders();
        },
        render_list: function(orders) {
            if (orders) {
                var self = this;
                var contents = this.$el[0].querySelector('.order-list-contents');
                contents.innerHTML = "";
                for (var i = 0, len = Math.min(orders.length, 1000); i < len; i++) {
                    var order = orders[i];
                    order.amount_total = parseFloat(order.amount_total).toFixed(2);
                    var clientline_html = QWeb.render('OrderlistLine', {
                        widget: this,
                        order: order
                    });
                    var clientline = document.createElement('tbody');
                    clientline.innerHTML = clientline_html;
                    clientline = clientline.childNodes[1];
                    contents.appendChild(clientline);
                }
            }
        },
        reload_orders: function() {
            var self = this;
            var orders = self.pos.get('pos_print_order_list');
            this.render_list(orders);
        },
        reloading_orders: function() {
            var self = this;
            var domain = []
            var params = self.pos.get_order().get_screen_data('params');
            if (params && params.receipt_ref) {
                domain = ['pos_reference', '=', params.receipt_ref];
            } else if (params && params.order_id) {
                domain = ['id', '=', params.order_id];
            }
            $.blockUI();
            rpc.query({
                model: "pos.order",
                method: "ac_pos_search_read",
                args: [
                    [
                        ['state', 'not in', ['cancel']], domain
                    ]
                ]
            }).then(function(result) {
                $.unblockUI();
                self.pos.db.add_orders(result);
                self.pos.set({
                    'pos_print_order_list': result
                });
                self.reload_orders();
                return self.pos.get('pos_print_order_list');
            }).fail(function(error, event) {
                $.unblockUI();
                if (error.code === 200) { // Business Logic Error, not a connection problem
                    self.gui.show_popup('error-traceback', {
                        message: error.data.message,
                        comment: error.data.debug
                    });
                }
                // prevent an error popup creation by the rpc failure
                // we want the failure to be silent as we send the orders in the background
                event.preventDefault();
                console.error('Failed to send orders:', orders);
                var orders = self.pos.get('pos_print_order_list');
                self.reload_orders();
                return orders
            });
        },
        renderElement: function() {
            var self = this;
            self._super();
        },
    });
    gui.define_screen({
        name: 'orderlist',
        widget: OrderListScreenWidget
    });

    DB.include({
        init: function(options) {
            this._super.apply(this, arguments);
            this.order_write_date = null;
            this.order_by_id = {};
            this.order_sorted = [];
        },
        get_order_write_date: function() {
            return this.order_write_date;
        },
        get_order_by_id: function(id) {
            return this.order_by_id[id];
        },
        add_orders: function(orders) {
            var updated_count = 0;
            var new_write_date = '';
            for (var i = 0, len = orders.length; i < len; i++) {
                var order = orders[i];
                if (this.order_write_date &&
                    this.order_by_id[order.id] &&
                    new Date(this.order_write_date).getTime() + 1000 >=
                    new Date(order.write_date).getTime()) {
                    continue;
                } else if (new_write_date < order.write_date) {
                    new_write_date = order.write_date;
                }
                if (!this.order_by_id[order.id]) {
                    this.order_sorted.push(order.id);
                }
                this.order_by_id[order.id] = order;
                updated_count += 1;
            }
            this.order_write_date = new_write_date || this.order_write_date;
            if (updated_count) {
                // If there were updates, we need to completely 
                this.order_search_string = "";
                for (var id in this.order_by_id) {
                    var order = this.order_by_id[id];
                    if (is_pos_reservation_install) {
                        this.order_search_string += this._order_search_string(order);
                    }
                }
            }
            return updated_count;
        },
    })

    var _super_orderline = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        initialize: function(attr, options) {
            this.note = '';
            _super_orderline.initialize.call(this, attr, options);
        },
        set_line_remark: function(remark) {
            this.set('remark', remark);
        },
        get_line_note: function() {
            return this.get('remark');
        },
    })

    var _super_Order = models.Order.prototype;
    models.Order = models.Order.extend({
        initialize: function(attributes, options) {
            this.reprint_receipt = false;
            _super_Order.initialize.apply(this, arguments);
        },
        set_shop_details: function(shop_details) {
            this.shop_details = shop_details;
        },
        get_shop_details: function() {
            return this.shop_details;
        },
        set_print_won_amount: function(won_amount) {
            this.print_won_amount = won_amount;
        },
        get_print_won_amount: function() {
            return this.print_won_amount;
        },
        set_print_redeem_amount: function(redeem_amount) {
            this.print_redeem_amount = redeem_amount;
        },
        get_print_redeem_amount: function() {
            return this.print_redeem_amount;
        },
        get_reprint_receipt: function() {
            return this.reprint_receipt;
        },
        set_reprint_receipt: function(reprint_receipt) {
            this.reprint_receipt = reprint_receipt;
        },
        get_reprint_receipt: function() {
            return this.reprint_receipt;
        },
        set_order_id: function(order_id) {
            this.set('order_id', order_id);
        },
        get_order_id: function() {
            return this.get('order_id');
        },
        set_amount_paid: function(amount_paid) {
            this.set('amount_paid', amount_paid);
            this.trigger('change', this);
        },
        get_amount_paid: function() {
            return this.get('amount_paid');
        },
        set_amount_return: function(amount_return) {
            this.set('amount_return', amount_return);
        },
        get_amount_return: function() {
            return this.get('amount_return');
        },
        set_amount_tax: function(amount_tax) {
            this.set('amount_tax', amount_tax);
        },
        get_amount_tax: function() {
            return this.get('amount_tax');
        },
        set_amount_total: function(amount_total) {
            this.set('amount_total', amount_total);
        },
        get_remaning: function() {
            return parseFloat(this.get_amount_total()) - parseFloat(this.get_amount_paid());
        },
        get_amount_total: function() {
            return this.get('amount_total');
        },
        set_company_id: function(company_id) {
            this.set('company_id', company_id);
        },
        get_company_id: function() {
            return this.get('company_id');
        },
        set_date_order: function(date_order) {
            this.set('date_order', date_order);
        },
        get_date_order: function() {
            return this.get('date_order');
        },
        set_pos_reference: function(pos_reference) {
            this.set('pos_reference', pos_reference)
        },
        get_pos_reference: function() {
            return this.get('pos_reference')
        },
        set_user_name: function(user_id) {
            this.set('user_id', user_id);
        },
        get_user_name: function() {
            return this.get('user_id');
        },
        set_journal: function(statement_ids) {
            this.set('statement_ids', statement_ids)
        },
        get_journal: function() {
            return this.get('statement_ids');
        },
        set_rjournal: function(statement_ids) {
            this.set('rstatement_ids', statement_ids)
        },
        get_rjournal: function() {
            return this.get('rstatement_ids');
        },
        export_for_printing: function() {
            var json = _super_Order.export_for_printing.apply(this, arguments);
            json.company_details = this.pos.company;
            json.print_date_order = this.get_date_order() ? moment(new Date(this.get_date_order())).format('DD/MM/YYYY') : this.get_date_order();
            var shop = this.get_shop_details();
            var shop_details = {};
            if (shop && shop[0]) {
                shop_details = {
                    name: shop[0].name,
                    city: shop[0].city,
                    zip: shop[0].zip,
                    street: shop[0].street,
                    street2: shop[0].street2,
                    logo: 'data:image/png;base64,' + shop[0].image,
                    phone: shop[0].phone,
                    email: shop[0].email
                };
            }
            json['print_shop_address_id'] = shop_details;
            return json;
        },
    });

});