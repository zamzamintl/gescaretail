odoo.define('pos_reservation.pos_reservation', function(require) {
    "use strict"

    var core = require('web.core');
    var DB = require('point_of_sale.DB');
    var field_utils = require('web.field_utils');
    var gui = require('point_of_sale.gui');
    var models = require('point_of_sale.models');
    var PopupWidget = require('point_of_sale.popups');
    var rpc = require('web.rpc');
    var screens = require('point_of_sale.screens');
    var session = require('web.session');
    var utils = require('web.utils');

    var QWeb = core.qweb;
    var round_pr = utils.round_precision;
    var round_di = utils.round_decimals;
    var _t = core._t;

    models.load_fields("account.tax", ['description']);

    var is_pos_loyalty_amount_install = _.contains(session.module_list, 'pos_loyalty_amount');
    var is_pos_gift_card_install = _.contains(session.module_list, 'pos_gift_card');
    var is_pos_credit_voucher_install = _.contains(session.module_list, 'pos_credit_voucher');

    var BookingOrderButton = screens.ActionButtonWidget.extend({
        template: 'BookingOrderButton',
        button_click: function() {
            this.gui.show_screen('reserved_orderlist');
        },
    });
    screens.define_action_button({
        'name': 'booking_order',
        'widget': BookingOrderButton,
        'condition': function() {
            return this.pos.config.enable_order_reservation;
        },
    });

    /*Booking  Order list screen */
    var ReservedOrderListScreenWidget = screens.ScreenWidget.extend({
        template: 'ReservedOrderListScreenWidget',

        init: function(parent, options) {
            var self = this;
            this._super(parent, options);
            this._filter_reserved_orders();
            this.reload_btn = function() {
                $('.fa-refresh').toggleClass('rotate', 'rotate-reset');
                self.reloading_orders();
            };
        },
        _filter_reserved_orders: function() {
            var self = this;
            self.reserved_orders = [];
            _.each(self.pos.get('pos_order_list'), function(order) {
                if (order && (order.reserved || order.internal_reservation)) {
                    self.reserved_orders.push(order)
                }
            });
        },
        _get_reserved_orders: function() {
            if (this.reserved_orders.length > 0) {
                return this.reserved_orders
            }
            return false
        },
        date: "all",

        start: function() {
            var self = this;
            this._super();

            this.$('.back').click(function() {
                self.gui.show_screen('products');
            });

            var orders = self._get_reserved_orders()
            this.render_list(orders);

            $('input#datepicker').datepicker({
                dateFormat: 'dd/mm/yy',
                autoclose: true,
                closeText: 'Clear',
                showButtonPanel: true,
                onSelect: function(dateText, inst) {
                    var date = $(this).val();
                    if (date) {
                        date = moment(date, 'DD/MM/YYYY'); 
                        self.date  = moment(date).format("YYYY-MM-DD");
                        self.render_list(self._get_reserved_orders());
                    }
                },
                onClose: function(dateText, inst) {
                    if (!dateText) {
                        self.date = "all";
                        self.render_list(self._get_reserved_orders());
                    }
                }
            }).focus(function() {
                var thisCalendar = $(this);
                $('.ui-datepicker-close').click(function() {
                    thisCalendar.val('');
                    self.date = "all";
                    self.render_list(self._get_reserved_orders());
                });
            });

//            this.$('.reserved-order-list-contents').delegate('.order-line td:not(.order_history_button)', 'click', function(event) {
//                var order_id = parseInt($(this).parent().data('id'));
//                self.gui.show_screen('orderdetail', {
//                    'order_id': order_id
//                });
//            });

            //Pay due Amount
            this.$('.reserved-order-list-contents').delegate('#pay_due_amt', 'click', function(event) {
                var order_id = parseInt($(this).data('id'));
                self.pay_order_due(order_id);
            });

            this.$('.reserved-order-list-contents').delegate('#refund_order', 'click', function(event) {
                var order_id = parseInt($(this).data('id'));
                self.refund_order(order_id);
            });
            
            this.$('.reserved-order-list-contents').delegate('#cancel_order', 'click', function(event) {
                var order = self.pos.get_order();
                var order_id = parseInt($(this).data('id'));
                var result = self.pos.db.get_order_by_id(order_id);

                self.gui.show_popup("cancel_order_popup", {
                    'order': result
                });
            });

            this.$('.reserved-order-list-contents').delegate('#delivery_date', 'click', function(event) {
                var order = self.pos.get_order();
                var order_id = parseInt($(this).data('id'));
                var result = self.pos.db.get_order_by_id(order_id);
                order.set_reserved_delivery_date(result.delivery_date);
                self.gui.show_popup("delivery_date_popup", {
                    'order': result,
                    'new_date': false
                });
            });

            //search box
            var search_timeout = null;
            if (this.pos.config.iface_vkeyboard && self.chrome.widget.keyboard) {
                self.chrome.widget.keyboard.connect(this.$('.searchbox input'));
            }
            this.$('.searchbox input').on('keyup', function(event) {
//                $(this).autocomplete({
//                    source: self.search_list,
//                    select: function(a, b) {
//                        self.perform_search(b.item.value, true);
//                    }
//                })
                clearTimeout(search_timeout);
                var query = this.value;
                search_timeout = setTimeout(function() {
                    self.perform_search(query, event.which === 13);
                }, 70);
            });

            this.$('.searchbox .search-clear').click(function() {
                self.clear_search();
            });

        },
        refund_order: function(order_id) {
            var self = this;
            var result = self.pos.db.get_order_by_id(order_id);
            rpc.query({
                model: "pos.order",
                method: "search_read",
                args: [[['id', '=', order_id],['state', 'in', ['draft']]]]
            }).then(function(order){
                    if (order && order[0]) {
                        var result = order[0]
                        if (result.state == "paid") {
                            alert("Sorry, This order is paid State");
                            return
                        }
                        if (result.state == "done") {
                            alert("Sorry, This Order is Done State");
                            return
                        }
                        if (result && result.lines.length > 0) {
                            var count = 0;
                            var selectedOrder = self.pos.get_order();
                            var currentOrderLines = selectedOrder.get_orderlines();
                            if (currentOrderLines.length > 0) {
                                for (var i = 0; i <= currentOrderLines.length + 1; i++) {
                                    _.each(currentOrderLines, function(item) {
                                        selectedOrder.remove_orderline(item);
                                    });
                                }
                            }
                            var partner = false;
                            if (result.partner_id && result.partner_id[0]) {
                                partner = self.pos.db.get_partner_by_id(result.partner_id[0])
                            }
                            if (result.internal_reservation) {
                                selectedOrder.set_is_internal_reservation(result.internal_reservation);
                            }
                            selectedOrder.set_reservation_mode(result.reserved);
                            selectedOrder.set_reserved_delivery_date(result.delivery_date);
                            selectedOrder.set_client(partner);
                            selectedOrder.set_pos_reference(result.pos_reference);
                            var sale_user_id = result.sale_user_id ? result.sale_user_id : false
                            if(sale_user_id){
                                if(sale_user_id[0]){
                                    selectedOrder.set('sale_user_id', sale_user_id[0])
                                }
                                if(sale_user_id[1]){
                                    selectedOrder.set('sale_user', sale_user_id[1])
                                }
                            }
                            if (result.lines) {
                                rpc.query({
                                    model: "pos.order.line",
                                    method: "search_read",
                                    args: [[['id', 'in', result.lines]]]
                                }).then(function(results){
                                        if (results) {
                                             var prd = self.pos.db.get_product_by_id(self.pos.config.prod_for_payment[0]);
                                            _.each(results, function(res) {
                                                var product = self.pos.db.get_product_by_id(Number(res.product_id[0]));
                                                if (product) {
                                                    if(prd.id != product.id){
                                                        var line = new models.Orderline({}, {
                                                            pos: self.pos,
                                                            order: selectedOrder,
                                                            product: product
                                                        });
                                                        if(res.ignor_for_loyalty){
                                                            line.set_ignor_for_loyalty(res.ignor_for_loyalty);
                                                        }
                                                        if(res.note){
                                                            line.set_note(res.note);
                                                        }
                                                        line.set_discount(res.discount);
                                                        line.set_quantity(res.qty * -1);
                                                        line.set_unit_price(0);
                                                        selectedOrder.add_orderline(line);
                                                        selectedOrder.select_orderline(selectedOrder.get_last_orderline());
                                                        if (selectedOrder.get_selected_orderline()) {
                                                            selectedOrder.get_selected_orderline().set_cancel_process(order_id);
                                                            selectedOrder.get_selected_orderline().set_cancel_item(true);
                                                            selectedOrder.get_selected_orderline().set_cancel_item_id(res.id);
                                                        }
                                                    }
                                                }
                                            });
                                            if (result.total_advance_pay) {
                                                var paid_amt = result.amount_paid;
                                                paid_amt = parseFloat(result.total_advance_pay) + parseFloat(paid_amt)
                                                selectedOrder.set_amount_paid(parseFloat(result.total_advance_pay) + parseFloat(paid_amt));
                                                if(paid_amt != 0){
                                                    selectedOrder.add_product(prd, {
                                                        'price': -paid_amt
                                                    });
                                                }
                                            }
                                            self.gui.show_screen('payment');
                                        }
                                    }, function(type,err){});
                                selectedOrder.set_order_id(order_id);
                                selectedOrder.set_cancel_order(true);
                            }
                            selectedOrder.set_sequence(result.name);
                        }
                    }
            }, function(type,err){});
        },
        pay_due_order: function(order_id,result,picking_done = true){
            var self = this;
            if (result && result.lines.length > 0) {
                var count = 0;
                var selectedOrder = self.pos.get_order();
                var currentOrderLines = selectedOrder.get_orderlines();
                if (currentOrderLines.length > 0) {
                    for (var i = 0; i <= currentOrderLines.length + 1; i++) {
                        _.each(currentOrderLines, function(item) {
                            selectedOrder.remove_orderline(item);
                        });
                    }
                }
                var partner = false;
                if (result.partner_id && result.partner_id[0]) {
                    partner = self.pos.db.get_partner_by_id(result.partner_id[0])
                }
                if (result.internal_reservation) {
                    selectedOrder.set_is_internal_reservation(result.internal_reservation);
                    if(!picking_done){
                        selectedOrder.set_is_picking_done(false);
                    }
                }
                selectedOrder.set_reservation_mode(result.reserved);
                selectedOrder.set_reserved_delivery_date(result.delivery_date);
                selectedOrder.set_client(partner);
                selectedOrder.set_pos_reference(result.pos_reference);
                selectedOrder.set_paying_due(true);
                var sale_user_id = result.sale_user_id ? result.sale_user_id : false
                if(sale_user_id){
                    if(sale_user_id[0]){
                        selectedOrder.set('sale_user_id', sale_user_id[0])
                    }
                    if(sale_user_id[1]){
                        selectedOrder.set('sale_user', sale_user_id[1])
                    }
                }
                if (result.lines) {
                    rpc.query({
                        model: "pos.order.line",
                        method: "search_read",
                        args: [[['id', 'in', result.lines]]]
                    }).then(
                        function(results) {
                            if (results) {
                                _.each(results, function(res) {
                                    var product = self.pos.db.get_product_by_id(Number(res.product_id[0]));
                                    if (product) {
                                        var line = new models.Orderline({}, {
                                            pos: self.pos,
                                            order: selectedOrder,
                                            product: product
                                        });
                                        if(res.ignor_for_loyalty){
                                            line.set_ignor_for_loyalty(res.ignor_for_loyalty);
                                        }
                                        if(res.note){
                                            line.set_note(res.note);
                                        }
                                        line.set_discount(res.discount);
                                        line.set_quantity(res.qty);
                                        line.set_unit_price(res.price_unit);
                                        selectedOrder.add_orderline(line);
                                        selectedOrder.select_orderline(selectedOrder.get_last_orderline());
                                    }
                                });
                                var prd = self.pos.db.get_product_by_id(self.pos.config.prod_for_payment[0]);
                                if (result.total_advance_pay) {
                                    var paid_amt = result.amount_paid;
                                    selectedOrder.set_amount_paid(parseFloat(result.total_advance_pay) + parseFloat(paid_amt));
                                    if(paid_amt != 0){
                                        selectedOrder.add_product(prd, {
                                            'price': -paid_amt
                                        });
                                    }
                                }
                                self.gui.show_screen('payment');
                            }
                        });
                    selectedOrder.set_order_id(order_id);
                }
                selectedOrder.set_sequence(result.name);
            }
        },
        pay_order_due: function(order_id) {
            var self = this;
            var result = self.pos.db.get_order_by_id(order_id);
            rpc.query({
                model: "pos.order",
                method: "search_read",
                args: [[['id', '=', order_id],['state', 'in', ['draft']]]]
            }).then(function(order){
                    if (order && order[0]) {
                        var result = order[0]
                        if (result.state == "paid") {
                            alert("Sorry, This order is paid State");
                            return
                        }
                        if (result.state == "done") {
                            alert("Sorry, This Order is Done State");
                            return
                        }
                        if(result.pos_picking_status != 'done'){
                            self.gui.show_popup('confirm', {
                                title: _t('Warning !!'),
                                body: _t('You collect a product which is not (yet) in the reserved location. Are you sure?'),
                                confirm: function() {
                                    self.pos.gui.select_user({
                                        'security': true,
                                        'current_user': null,
                                        'title': _t('Change Cashier'),
                                    }).then(function(user) {
                                        self.pos.set_cashier(user);
                                        self.chrome.widget.username.renderElement();
                                        self.pay_due_order(order_id,result,false);
                                    });
                                },
                            });
                        }else{
                            self.pos.gui.select_user({
                                'security': true,
                                'current_user': null,
                                'title': _t('Change Cashier'),
                            }).then(function(user) {
                                self.pos.set_cashier(user);
                                self.chrome.widget.username.renderElement();
                                self.pay_due_order(order_id,result,true);
                            });
                        }
                    }
                });
        },
        show: function() {
            this._super();
            this.reloading_orders();
            $('.button.reserved').removeClass('selected').trigger('click');
        },
        perform_search: function(query, associate_result) {
            var self = this;
            if (query) {
                var orders = this.pos.db.search_order(query);
                self.render_list(orders);
            } else {
                var orders = self._get_reserved_orders()
                this.render_list(orders);
            }
        },
        clear_search: function() {
            var orders = this._get_reserved_orders()
            this.render_list(orders);
            this.$('.searchbox input')[0].value = '';
            this.$('.searchbox input').focus();
        },
        render_list: function(orders) {
            var self = this;
            var contents = this.$el[0].querySelector('.reserved-order-list-contents');
            contents.innerHTML = "";
            var temp = [];
            if (self.date !== "" && self.date !== "all") {
                var x = [];
                for (var i = 0; i < orders.length; i++) {
                    var date_order = $.datepicker.formatDate("yy-mm-dd", new Date(orders[i].date_order));
                    if (self.date === date_order) {
                        x.push(orders[i]);
                    }
                }
                orders = x;
            }
            for (var i = 0, len = Math.min(orders.length, 1000); i < len; i++) {
                var order = orders[i];
                order.total_amount = parseFloat(parseFloat(order.total_amount) - parseFloat(order.amount_paid)).toFixed(2);
                var clientline_html = QWeb.render('ReservedOrderlistLine', {
                    widget: this,
                    order: order
                });
                var clientline = document.createElement('tbody');
                clientline.innerHTML = clientline_html;
                clientline = clientline.childNodes[1];
                contents.appendChild(clientline);
            }
        },
        reload_orders: function() {
            var self = this;
            self._filter_reserved_orders();
            var orders = self._get_reserved_orders()
            this.search_list = []
            _.each(self.pos.partners, function(partner) {
                self.search_list.push(partner.name);
            });
            _.each(orders, function(order) {
                self.search_list.push(order.display_name, order.pos_reference)
            });
            this.render_list(orders);
        },
        reloading_orders: function() {
            var self = this;
            self.pos.load_new_orders();
            self.reload_orders();
        },
        renderElement: function() {
            var self = this;
            self._super();
            self.el.querySelector('.button.reload').addEventListener('click', this.reload_btn);
        },
    });
    gui.define_screen({
        name: 'reserved_orderlist',
        widget: ReservedOrderListScreenWidget
    });

    var OrderDetailScreenWidget = screens.ScreenWidget.extend({
        template: 'OrderDetailScreenWidget',
        init: function(parent, options) {
            var self = this;
            self._super(parent, options);
        },
        show: function() {
            var self = this;
            self._super();

            var order = self.pos.get_order();
            var params = order.get_screen_data('params');
            var order_id = false;
            if (params) {
                order_id = params.order_id;
            }
            if (order_id) {
                self.clicked_order = self.pos.db.get_order_by_id(order_id)
            }
            this.renderElement();
            this.$('.back').click(function() {
                self.gui.back();
                if (params.previous) {
                    self.pos.get_order().set_screen_data('previous-screen', params.previous);
                    if (params.partner_id) {
                        $('.client-list-contents').find('.client-line[data-id="' + params.partner_id + '"]').click();
                        $('#show_client_history').click();
                    }
                }

            });
            if (self.clicked_order) {
                this.$('.pay').click(function() {
                    self.pos.gui.screen_instances.reserved_orderlist.pay_order_due(order_id)
                });
                var contents = this.$('.order-details-contents');
                contents.append($(QWeb.render('OrderDetails', {
                    widget: this,
                    order: self.clicked_order
                })));
                rpc.query({
                    model: "account.bank.statement.line",
                    method: "search_read",
                    args: [[['pos_statement_id', '=', order_id]]]
                },{
                    'async': true
                }).then(function(statements){
                    if (statements) {
                        self.render_list(statements);
                    }
                }, function(type,err){});
            }

        },
        render_list: function(statements) {
            var contents = this.$el[0].querySelector('.paymentline-list-contents');
            contents.innerHTML = "";
            for (var i = 0, len = Math.min(statements.length, 1000); i < len; i++) {
                var statement = statements[i];
                var paymentline_html = QWeb.render('PaymentLines', {
                    widget: this,
                    statement: statement
                });
                var paymentline = document.createElement('tbody');
                paymentline.innerHTML = paymentline_html;
                paymentline = paymentline.childNodes[1];
                contents.append(paymentline);
            }
        },
    });
    gui.define_screen({
        name: 'orderdetail',
        widget: OrderDetailScreenWidget
    });

    var CancelOrderPopup = PopupWidget.extend({
        template: 'CancelOrderPopup',
        init: function(parent, args) {
            var self = this;
            this._super(parent, args);
            this.options = {};
            this.line = [];
            this.select_all = function(e) {
                $('.ac_selected_product').prop('checked', $('.check_all_items_checkbox').prop('checked'));
                var contents = self.$el[0].querySelector('div.product_info ul');
                $(contents).empty();
                $('.ac_selected_product').trigger('change');
            }
            this.update_qty = function(ev) {
                ev.preventDefault();
                var $link = $(ev.currentTarget);
                self._update_qty($link);
                return false;
            };
            this.keydown_qty = function(e) {
                if ($(this).val() > $(this).data('max')) {
                    $(this).val($(this).data('max'))
                }
                if ($(this).val() < $(this).data('min')) {
                    $(this).val($(this).data('min'))
                }
                if (/\D/g.test(this.value)) {
                    // Filter non-digits from input value.
                    this.value = this.value.replace(/\D/g, '');
                }
                self.update_line(self.generate_line($(this).attr('name')));
            };
        },
        _update_qty: function($link) {
            var self = this;
            var $input = $link.parent().parent().find("input");
            var min = parseFloat($input.data("min") || 0);
            var max = parseFloat($input.data("max") || Infinity);
            var quantity = ($link.has(".fa-minus").length ? -1 : 1) + parseFloat($input.val(), 10);
            $input.val(quantity > min ? (quantity < max ? quantity : max) : min);
            $('input[name="' + $input.attr("name") + '"]').val(quantity > min ? (quantity < max ? quantity : max) : min);
            $input.change();
            self.update_line(self.generate_line($($input).attr('name')));
        },
        show: function(options) {
            var self = this;
            options = options || {};
            this._super(options);
            this.order_tobe_cancel = options.order;
            if (this.order_tobe_cancel) {
                rpc.query({
                    model: "pos.order.line",
                    method: "search_read",
                    args: [[['id', 'in', this.order_tobe_cancel.lines],['qty', '>', 0]]]
                },{
                    'async': false
                }).then(function(lines){
                    _.each(lines, function(line) {
                        self.line[line.id] = line
                    });
                    self.lines = lines;
                }, function(type,err){});
            }
            this.renderElement();
            self.update_summary();
        },
        update_line: function(line) {
            var self = this;
            var contents = this.$el[0].querySelector('div.product_info ul');
            var li = $(contents).find('li[data-id="' + line.id + '"]')
            if (li.length) {
                var new_line = self.rerender_line(line);
                $(li).replaceWith(new_line);
                self.update_summary()
            }
        },
        rerender_line: function(line) {
            var self = this;
            var el_str = QWeb.render('CancelLines', {
                widget: this,
                line: line
            });
            var el_ul = document.createElement('ul');
            el_ul.innerHTML = el_str;
            el_ul = el_ul.childNodes[1];
            el_ul.querySelector('.remove_line').addEventListener('click', function(e) {
                $('.ac_selected_product[data-name="' + line.id + '"]').prop('checked', false);
                self.render_lines(line, "remove");
                if (!$('.ac_selected_product:checked').length) {
                    $('.check_all_items_checkbox').prop('checked', false);
                }
            });
            return el_ul;
        },
        render_lines: function(line, operation) {
            var self = this;
            var contents = this.$el[0].querySelector('div.product_info ul');
            if (operation == "remove") {
                $(contents).find('li[data-id="' + line.id + '"]').remove();
                self.update_summary()
                return
            }
            var el_ul = self.rerender_line(line);
            contents.appendChild(el_ul);
            self.update_summary()
            var line_count = $(contents).find('ul li').length;
            this.el.querySelector('.product_info').scrollTop = 100 * line_count;
        },
        click_confirm: function() {
            var self = this;
            var selectedOrder = this.pos.get_order();
            this.total = 0.00;
            this.remaining_item_total = 0.00;
            var temp_orderline_ids = [];
            _.each($('.ac_selected_product:checked'), function(item) {
                var orderline = self.line[$(item).data('name')];
                temp_orderline_ids.push($(item).data('name'));
                var product = self.pos.db.get_product_by_id(orderline.product_id[0]);
                var qty = $('input[name="' + orderline.id + '"').val();
                selectedOrder.add_product(product, {
                    quantity: qty * -1,
                    price: 0.00
                });
                if (selectedOrder.get_selected_orderline()) {
                    selectedOrder.get_selected_orderline().set_cancel_process(orderline.order_id);
                    selectedOrder.get_selected_orderline().set_cancel_item(true);
                    selectedOrder.get_selected_orderline().set_cancel_item_id(orderline.id);
                    if ((orderline.qty - qty) <= 0) {
                        selectedOrder.get_selected_orderline().set_line_status("full");
                    } else {
                        selectedOrder.get_selected_orderline().set_line_status("partial");
                    }
                    if (product.type != "service") {
                        selectedOrder.get_selected_orderline().set_consider_qty(orderline.qty - qty);
                    }
                }
                self.total += orderline.price_unit * qty;
            });
            if (temp_orderline_ids.length > 0) {
                _.each(self.lines, function(line) {
                    if ($.inArray(line.id, temp_orderline_ids) == -1) {
                        self.remaining_item_total += line.price_subtotal_incl;
                    }
                })
                self.add_charge_product();
                if (self.new_amount_due < 0) {
                    self.add_refund_product();
                } else {
                    self.add_charge_paid_product();
                }
                if (this.order_tobe_cancel.partner_id && this.order_tobe_cancel.partner_id[0]) {
                    var partner = self.pos.db.get_partner_by_id(this.order_tobe_cancel.partner_id[0])
                    selectedOrder.set_client(partner);
                }
                if(this.order_tobe_cancel.internal_reservation){
                    selectedOrder.set_is_internal_reservation(true);
                }else{
                    selectedOrder.set_reservation_mode(true);
                }
                selectedOrder.set_pos_reference(this.order_tobe_cancel.pos_reference);
                selectedOrder.set_sequence(this.order_tobe_cancel.name);
                selectedOrder.set_cancel_order(true);
                selectedOrder.set_order_id(this.order_tobe_cancel.id);
                selectedOrder.set_reserved_delivery_date(this.order_tobe_cancel.delivery_date);
               // selectedOrder.set_amount_paid(this.order_tobe_cancel.amount_paid);
                if(this.order_tobe_cancel.sale_user_id){
                    var sale_user_id = this.order_tobe_cancel.sale_user_id ?this.order_tobe_cancel.sale_user_id : false
                    if(sale_user_id){
                        if(sale_user_id[0]){
                            selectedOrder.set('sale_user_id', sale_user_id[0])
                        }
                        if(sale_user_id[1]){
                            selectedOrder.set('sale_user', sale_user_id[1])
                        }
                    }
                }
                selectedOrder.set_cancellation_charges(self.cancel_charge);
                selectedOrder.set_refund_amount(self.refundable_total);
                if (self.refundable_total > 0) {
                    selectedOrder.set_reservation_mode(false);
                }
                self.pos.gui.show_screen('payment');
                this.gui.close_popup();
            }
        },
        get_product_image_url: function(product_id) {
            return window.location.origin + '/web/image?model=product.product&field=image_medium&id=' + product_id;
        },
        generate_line: function(line_id) {
            var self = this;
            var selected_line = self.line[line_id]
            var qty = $('.js_quantity[name="' + line_id + '"]').val();
            var line = false
            if (selected_line) {
                var line = {
                    product_name: selected_line.display_name,
                    price: qty * selected_line.price_unit,
                    qty: self.get_qty_str(selected_line.product_id[0], qty) || 0.00,
                    id: selected_line.id,
                }
                return line
            }
            return false
        },
        get_qty_str: function(product_id, qty) {
            var self = this;
            var qty;
            var product = self.pos.db.get_product_by_id(product_id);
            if (product) {
                var unit = self.pos.units_by_id[product.uom_id[0]]
                var new_qty = '';
                if (unit) {
                    qty = round_pr(qty, unit.rounding);
                    var decimals = self.pos.dp['Product Unit of Measure'];
                    new_qty = field_utils.format.float(round_di(qty, decimals), {
                        digits: [69, decimals]
                    });
                    return new_qty + '/' + unit.display_name
                }
            }
        },
        renderElement: function() {
            var self = this;
            this._super();
            this.$('.input-group-addon').delegate('a.js_qty', 'click', this.update_qty);
            this.$('div.input-group').delegate('.js_quantity', 'input', this.keydown_qty);
            $('.ac_selected_product').change(function() {
                var line_id = $(this).data('name');
                var line = self.generate_line(line_id)
                if (line) {
                    if ($(this).prop('checked')) {
                        self.render_lines(line);
                        if ($('.ac_selected_product:checked').length === $('.ac_selected_product').length) {
                            $('.check_all_items_checkbox').prop('checked', true);
                        }
                    } else {
                        self.render_lines(line, "remove");
                        $('.check_all_items_checkbox').prop('checked', false);
                    }
                }
            })
            this.$('.check_all_items').delegate('.label', 'click', function(e) {
                $('.check_all_items_checkbox').prop('checked', !$('.check_all_items_checkbox').prop('checked'));
                self.select_all(e);
            });
            this.$('.check_all_items').delegate('.check_all_items_checkbox', 'click', this.select_all);
        },
        get_total: function() {
            var self = this;
            var total = 0.00;
            var temp_orderline_ids = [];
            _.each($('.ac_selected_product:checked'), function(item) {
                var orderline = self.line[$(item).data('name')];
                if (orderline) {
                    temp_orderline_ids.push($(item).data('name'));
                    var qty = $('input[name="' + orderline.id + '"').val();
                    if (orderline.discount > 0 || (orderline.tax_ids && orderline.tax_ids.length > 0)) {
                        total += (orderline.price_subtotal_incl / orderline.qty) * qty;
                    } else {
                        total += (orderline.price_unit) * qty;
                    }
                }
            });
            return total;
        },
        update_summary: function() {
            var self = this;
            self.cancel_charge = self._calculate_cancellation_charges();
            var cancel_order_total = self.get_total();
            var new_order_total = self.order_tobe_cancel.total_amount - cancel_order_total + self.cancel_charge;
            self.new_amount_due = new_order_total - self.order_tobe_cancel.total_advance_pay;
            self.refundable_total = self._calculate_refund_amount() ? self._calculate_refund_amount() + self.cancel_charge : self._calculate_refund_amount();
            if (self.new_amount_due > 0) {
                self.refundable_total = 0
            }

            this.el.querySelector('.cancel_order_summary .cancel_order_total > .value').textContent = this.format_currency(cancel_order_total);
            this.el.querySelector('.cancel_order_summary .new_order_total > .value').textContent = this.format_currency(new_order_total);
            this.el.querySelector('.cancel_order_summary .new_amount_due > .value').textContent = this.format_currency(self.new_amount_due > 0 ? self.new_amount_due : 0.00);
            this.el.querySelector('.cancel_order_summary .refundable_total > .value').textContent = this.format_currency(Math.abs(self.refundable_total));
            this.el.querySelector('.cancel_order_summary .cancel_charge > .value').textContent = this.format_currency(self.cancel_charge);
        },
        _calculate_cancellation_charges: function() {
            var self = this;
            var price = 0.00;
            if (self.pos.config.cancellation_charges_type == "percentage") {
                price = (self.get_total() * self.pos.config.cancellation_charges) / 100;
            } else {
                price = self.pos.config.cancellation_charges;
            }
            return price
        },
        add_charge_product: function() {
            var self = this;
            var selectedOrder = self.pos.get_order();
            var price = self._calculate_cancellation_charges();
            if (self.pos.config.cancellation_charges_product_id) {
                var cancel_product = self.pos.db.get_product_by_id(self.pos.config.cancellation_charges_product_id[0]);
                if (cancel_product) {
                    selectedOrder.add_product(cancel_product, {
                        quantity: 1,
                        price: price
                    });
                    if(price == 0){
                        selectedOrder.get_selected_orderline().set_zero_charges(true);
                    }
                    //  selectedOrder.get_selected_orderline().set_cancel_item(true);
                } else {
                    alert(_t("Cannot Find Cancellation Product"));
                }
            } else {
                alert(_t("Please configure Cancellation product from Point of Sale Configuration"));
            }
        },
        add_charge_paid_product: function() {
            var self = this;
            if (self.pos.config.cancellation_charges != 0 && self._calculate_refund_amount() != 0) {
                self.add_paid_amount(self._calculate_refund_amount())
            }
        },
        _calculate_refund_amount: function() {
            var self = this;
            var current_order_total = self.order_tobe_cancel.amount_total - self.get_total();
            var customer_paid = (self.order_tobe_cancel.amount_total - self.order_tobe_cancel.amount_due);
            var final_amount = 0.00
            if (current_order_total < customer_paid) {
                final_amount = current_order_total - customer_paid;
            }
            return final_amount;
        },
        add_refund_product: function() {
            var self = this;
            var selectedOrder = self.pos.get_order();
            var price = self._calculate_refund_amount();
            if (self.pos.config.refund_amount_product_id) {
                var refund_product = self.pos.db.get_product_by_id(self.pos.config.refund_amount_product_id[0]);
                if (refund_product) {

                    selectedOrder.add_product(refund_product, {
                        quantity: 1,
                        price: price
                    });
                } else {
                    alert(_t("Cannot Find Refund Product"));
                }
            } else {
                alert(_t("Please configure Refund product from Point of Sale Configuration"));
            }
        },
        add_paid_amount: function(charges_price = false) {
            var self = this;
            var selectedOrder = self.pos.get_order();
            if (self.pos.config.prod_for_payment) {
                var paid_product = self.pos.db.get_product_by_id(self.pos.config.prod_for_payment[0]);
                if (charges_price && paid_product) {
                    selectedOrder.add_product(paid_product, {
                        quantity: 1,
                        price: charges_price
                    });
                } else if (paid_product) {
                    selectedOrder.add_product(paid_product, {
                        quantity: -1,
                        price: self.order_tobe_cancel.total_advance_pay
                    });
                } else {
                    alert(_t("Cannot Find Refund Product"));
                }
            } else {
                alert(_t("Please configure Paid Amount product from Point of Sale Configuration"));
            }
        },
    });
    gui.define_popup({
        name: 'cancel_order_popup',
        widget: CancelOrderPopup
    });

    /* Delivery Date POPUP */
    var DeliveryDatePopup = PopupWidget.extend({
        template: 'DeliveryDatePopup',
        show: function(options) {
            var self = this;
            this._super();
            var options = options || {}
            if (options) {
                this.payment_obj = options.payment_obj;
                this.new_date = options.new_date;
                this.to_be_update_order = options.order;
                this.draft = options.draft;
            }
            var order = this.pos.get_order();
            self.renderElement();
            if (order.get_reserved_delivery_date()) {
                $('#delivery_datepicker').val(order.get_reserved_delivery_date());
            }
            // $('#delivery_datepicker').focus();
        },
        click_confirm: function() {
            var self = this;
            var order = this.pos.get_order();
            order.set_delivery_date($('#delivery_datepicker').val() || false);
            order.set_reserved_delivery_date($('#delivery_datepicker').val() || false);
            if (this.new_date) {
                if (!this.draft && this.payment_obj) {
                    if (order.get_total_paid() != 0) {
                        //if(!order.get_reservation_mode()){
                        //    order.set_partial_pay(true);
                        //}
                        var total_paid_for_reservation = self.payment_obj.get_total_paid_for_reservation();
                        var advance_pay_product = self.pos.db.get_product_by_id(self.pos.config.prod_for_payment[0]);
                        
                        var line_dict = {pos: self.pos, order: order, product: advance_pay_product};
                        var line = new models.Orderline({}, line_dict);
                        line.set_quantity(1);
                        line.set_unit_price(total_paid_for_reservation);
                        line.advance_pay = true;
                        order.reservation_ticket = true;
                        order.set_reservation_mode(true);
                        order.add_orderline(line);
                        self.payment_obj.finalize_validation();
                        $('.js_reservation_mode').removeClass('highlight');
                    }
                } else if (this.draft) {
                    var total_paid_for_reservation = self.payment_obj.get_total_paid_for_reservation();
                    var advance_pay_product = self.pos.db.get_product_by_id(self.pos.config.prod_for_payment[0]);
                    
                    var line_dict = {pos: self.pos, order: order, product: advance_pay_product};
                    var line = new models.Orderline({}, line_dict);
                    line.set_quantity(1);
                    line.set_unit_price(total_paid_for_reservation);
                    line.advance_pay = true;
                    order.reservation_ticket = true;
                    order.add_orderline(line);
                    this.pos.push_order(order);
                    this.gui.show_screen('receipt');
                }
            } else {
                if (order && self.to_be_update_order.reserved_delivery_date != $('#delivery_datepicker').val()) {
                    rpc.query({
                        model: "pos.order",
                        method: "update_delivery_date",
                        args: [self.to_be_update_order.id, $('#delivery_datepicker').val()]
                    }).then(function(res){
                        self.pos.db.add_orders(res);
                        var temp_orders = self.pos.get('pos_order_list');
                        $.extend(temp_orders, res);
                        self.pos.set({
                            'pos_order_list': temp_orders
                        });
                    }, function(type,err){});
                }
            }
            this.gui.close_popup();
        },
        renderElement: function() {
            var self = this;
            this._super();
            $('#delivery_datepicker').datepicker({
                dateFormat: 'dd/mm/yy',
                minDate: new Date(),
                closeText: 'Clear',
                showButtonPanel: true,
            }).focus(function() {
                var thisCalendar = $(this);
                $('.ui-datepicker-close').click(function() {
                    thisCalendar.val('');
                });
            });
            $('#delivery_datepicker').datepicker('setDate', new Date());
        },
    });
    gui.define_popup({
        name: 'delivery_date_popup',
        widget: DeliveryDatePopup
    });

    DB.include({
        init: function(options) {
            this._super.apply(this, arguments);
            this.order_write_date = null;
            this.order_by_id = {};
            this.order_sorted = [];
            this.order_search_string = "";
            this._super(options);
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
                    this.order_search_string += this._order_search_string(order);
                }
            }
            return updated_count;
        },
        _order_search_string: function(order) {
            var str = order.name;
            if (order.pos_reference) {
                str += '|' + order.pos_reference;
            }
            if(order.partner_id && order.partner_id[1]){
                str += '|' + order.partner_id[1];
            }
            str = '' + order.id + ':' + str.replace(':', '') + '\n';
            return str;
        },
        get_order_write_date: function() {
            return this.order_write_date;
        },
        get_order_by_id: function(id) {
            return this.order_by_id[id];
        },
        search_order: function(query) {
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g, '.');
                query = query.replace(' ', '.+');
                var re = RegExp("([0-9]+):.*?" + query, "gi");
            } catch (e) {
                return [];
            }
            var results = [];
            var r;
            for (var i = 0; i < this.limit; i++) {
                r = re.exec(this.order_search_string);
                if (r) {
                    var id = Number(r[1]);
                    results.push(this.get_order_by_id(id));
                } else {
                    break;
                }
            }
            return  _.sortBy(results, function(results) {
                return results.partner_id[1];
            });
        },
    });

    var _super_posmodel = models.PosModel;
    models.PosModel = models.PosModel.extend({
        load_server_data: function() {
            var self = this;
            var loaded = _super_posmodel.prototype.load_server_data.call(this);
            return loaded.then(function() {
                self.reservation_domain_order = [];
                var date = new Date();
                var start_date = self.config.start_date || new Date().toJSON().slice(0, 10);
                var start_date;
                if (self.config.last_days) {
                    date.setDate(date.getDate() - self.config.last_days);
                }
                start_date = date.toJSON().slice(0, 10);
                self.reservation_domain_order.push(['state', '=', ['draft']]);
              //  self.reservation_domain_order.push(['create_date', '>=', start_date]);
                self.reservation_domain_order.push('|');
                self.reservation_domain_order.push(['picking_id.state', 'in', ['done','waiting','confirmed','cancel','assigned']]);
                self.reservation_domain_order.push(['picking_id', '=', false]);

                return rpc.query({
                    model: "pos.order",
                    method: "ac_pos_search_read",
                    args: [self.reservation_domain_order]
                }).then(function(orders){
                    self.db.add_orders(orders);
                    self.set({
                        'pos_order_list': orders
                    });
                    
                }, function(type,err){});
            });
        },
        load_new_orders: function() {
            var self = this;
            return rpc.query({
                model: "pos.order",
                method: "ac_pos_search_read",
                args: [self.reservation_domain_order],
            },{
                async: false
            }).then(function(result){
                self.db.order_write_date = null;
                self.db.order_by_id = {};
                self.db.order_sorted = [];
                self.db.order_search_string = "";
                self.db.add_orders(result);
                self.set({
                    'pos_order_list': result
                });
                return self.get('pos_order_list');
            }).fail(function(error, event) {
                if (error.code === 200) { // Business Logic Error, not a connection problem
                    self.gui.show_popup('error-traceback', {
                        message: error.data.message,
                        comment: error.data.debug
                    });
                }
                // prevent an error popup creation by the rpc failure
                // we want the failure to be silent as we send the orders in the background
                event.preventDefault();
                var orders = self.get('pos_order_list');
                return orders
            });
        },
    });

    var _super_Order = models.Order.prototype;
    models.Order = models.Order.extend({
        initialize: function(attributes, options) {
            _super_Order.initialize.apply(this, arguments);
            this.reserved_delivery_date = false;
            this.reservation_ticket = false;
            this.set({
                reservation_mode: false,
                delivery_date: false,
                draft_order: false,
                paying_due: false,
                fresh_order: false,
                is_picking_done:true,
            });
        },
        init_from_JSON: function(json) {
            _super_Order.init_from_JSON.apply(this, arguments);
            var orderlines = json.lines;
            var self = this;
            if (json.reserved || json.reserved_delivery_date) {
                for (var i = 0; i < orderlines.length; i++) {
                    var orderline = orderlines[i][2];
                    self.remove_orderline(orderline);
                }
                self.clean_all_paymentlines();
            }
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
        get_without_reservation_tax_details: function(){
            var details = {};
            var fulldetails = [];

            this.orderlines.each(function(line){
                if(!line.advance_pay){
                    var ldetails = line.get_tax_details();
                    for(var id in ldetails){
                        if(ldetails.hasOwnProperty(id)){
                            details[id] = (details[id] || 0) + ldetails[id];
                        }
                    }
                }
            });
            
            for(var id in details){
                if(details.hasOwnProperty(id)){
                    fulldetails.push({amount: details[id], tax: this.pos.taxes_by_id[id], name: this.pos.taxes_by_id[id].description});
                }
            }

            return fulldetails;
        },
        get_reservation_tax_details: function(){
            var details = {};
            var fulldetails = [];

            this.orderlines.each(function(line){
                if(line.advance_pay){
                    var ldetails = line.get_tax_details();
                    for(var id in ldetails){
                        if(ldetails.hasOwnProperty(id)){
                            details[id] = (details[id] || 0) + ldetails[id];
                        }
                    }
                }
            });

            for(var id in details){
                if(details.hasOwnProperty(id)){
                    fulldetails.push({amount: details[id], tax: this.pos.taxes_by_id[id], name: this.pos.taxes_by_id[id].description});
                }
            }

            return fulldetails;
        },
        get_rdue: function(paymentline) {
            if(this.reservation_ticket){
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
                return round_pr(Math.max(0,due), this.pos.currency.rounding);
            }else{
                return _super_Order.get_due.apply(this, arguments);
            }
        },
        get_reservation_total_with_tax: function() {
            return this.get_reservation_total_without_tax() + this.get_reservation_total_tax();
        },
        get_reservation_total_without_tax: function() {
            return round_pr(this.orderlines.reduce((function(sum, orderLine) {
                if(orderLine.advance_pay){
                    return sum + orderLine.get_price_without_tax();
                }
                return sum + 0;
            }), 0), this.pos.currency.rounding);
        },
        get_reservation_total_tax: function() {
            return round_pr(this.orderlines.reduce((function(sum, orderLine) {
                if(orderLine.advance_pay){
                    return sum + orderLine.get_tax();
                }
                return sum + 0;
            }), 0), this.pos.currency.rounding);
        },
        get_without_reservation_total_with_tax: function() {
            return this.get_without_reservation_total_without_tax() + this.get_without_reservation_total_tax();
        },
        get_without_reservation_total_without_tax: function() {
            return round_pr(this.orderlines.reduce((function(sum, orderLine) {
                if(orderLine.advance_pay){
                    return sum + 0;
                }
                return sum + orderLine.get_price_without_tax();
            }), 0), this.pos.currency.rounding);
        },
        get_without_reservation_total_tax: function() {
            return round_pr(this.orderlines.reduce((function(sum, orderLine) {
                if(orderLine.advance_pay){
                    return sum + 0;
                }
                return sum + orderLine.get_tax();
            }), 0), this.pos.currency.rounding);
        },
        clean_all_paymentlines: function() {
            var lines = this.paymentlines.models;
            var empty = [];
            for (var i = 0; i < lines.length; i++) {
                empty.push(lines[i]);
            }
            for (var i = 0; i < empty.length; i++) {
                this.remove_paymentline(empty[i]);
            }
        },
        set_is_picking_done: function(val) {
            this.set('is_picking_done', val)
        },
        get_is_picking_done: function() {
            return this.get('is_picking_done');
        },
        set_reservation_mode: function(mode) {
            this.set('reservation_mode', mode)
        },
        get_reservation_mode: function() {
            return this.get('reservation_mode');
        },
        set_cancel_order: function(val) {
            this.set('cancel_order', val)
        },
        get_cancel_order: function() {
            return this.get('cancel_order');
        },
        set_paying_due: function(val) {
            this.set('paying_due', val)
        },
        get_paying_due: function() {
            return this.get('paying_due');
        },
        set_draft_order: function(val) {
            this.set('draft_order', val);
        },
        get_draft_order: function() {
            return this.get('draft_order');
        },
        set_cancellation_charges: function(val) {
            this.set('cancellation_charges', val);
        },
        get_cancellation_charges: function() {
            return this.get('cancellation_charges');
        },
        set_refund_amount: function(refund_amount) {
            this.set('refund_amount', refund_amount);
        },
        get_refund_amount: function() {
            return this.get('refund_amount');
        },
        set_fresh_order: function(fresh_order) {
            this.set('fresh_order', fresh_order);
        },
        get_fresh_order: function() {
            return this.get('fresh_order');
        },
        set_reserved_delivery_date: function(reserved_delivery_date) {
            this.reserved_delivery_date = reserved_delivery_date;
            this.set('reserved_delivery_date', reserved_delivery_date);
        },
        get_reserved_delivery_date: function() {
            return this.reserved_delivery_date;
        },
        set_pos_reference: function(pos_reference) {
            this.set('pos_reference', pos_reference)
        },
        get_pos_reference: function() {
            return this.get('pos_reference')
        },
        set_amount_paid: function(amount_paid) {
            this.set('amount_paid', amount_paid);
            this.trigger('change',this);
        },
        get_amount_paid: function() {
            return this.get('amount_paid');
        },
        set_sequence: function(sequence) {
            this.set('sequence', sequence);
        },
        get_sequence: function() {
            return this.get('sequence');
        },
        set_order_id: function(order_id) {
            this.set('order_id', order_id);
        },
        get_order_id: function() {
            return this.get('order_id');
        },
        set_delivery_date: function(delivery_date) {
            this.delivery_date = delivery_date;
        },
        get_delivery_date: function() {
            return this.delivery_date;
        },
        set_delivery_charges: function(delivery_state) {
            this.delivery_state = delivery_state;
        },
        get_delivery_charges: function() {
            return this.delivery_state;
        },
        export_as_JSON: function() {
            var self = this;
            var new_val = {};
            var orders = _super_Order.export_as_JSON.call(this);
            var cancel_orders = '';
            _.each(self.get_orderlines(), function(line) {
                if (line.get_cancel_item()) {
                    cancel_orders += " " + line.get_cancel_item();
                }
            });
            var paid_product_orderLines = [];
            var update_product_orderLines = [];
            this.orderlines.each(_.bind( function(item) {
                if(item.advance_pay){
                    var temp_item = item.export_as_JSON();
                    temp_item.price_unit = temp_item.price_unit * -1;
                    temp_item.price_subtotal = temp_item.price_subtotal * -1;
                    temp_item.price_subtotal_incl = temp_item.price_subtotal_incl * -1;
                    update_product_orderLines.push([0, 0, item.export_as_JSON()]);
                    return paid_product_orderLines.push([0, 0, temp_item]);
                }
            }, this));
            new_val = {
                old_order_id: this.get_order_id(),
                delivery_date: this.get_reserved_delivery_date(),
                reserved: this.get_reservation_mode() || false,
                cancel_order_ref: cancel_orders || false,
                cancel_order: this.get_cancel_order() || false,
                set_as_draft: this.get_draft_order() || false,
                fresh_order: this.get_fresh_order() || false,
                reservation_ticket : this.reservation_ticket,
                paid_product_orderLines : paid_product_orderLines,
                update_product_orderLines : update_product_orderLines,
                is_picking_done : this.get_is_picking_done(),
            }
            $.extend(orders, new_val);
            return orders;
        },
    });

    var _super_orderline = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        initialize: function(attr, options) {
            this.delivery_charge_flag = false;
            this.cancel_item = false;
            this.consider_qty = 0;
            this.location_id = false;
            this.zero_charges = false;

            _super_orderline.initialize.call(this, attr, options);
        },
        //reservation
        set_zero_charges: function(val) {
            this.zero_charges = val;
        },
        get_zero_charges: function() {
            return this.zero_charges;
        },
        set_cancel_item: function(val) {
            this.set('cancel_item', val)
        },
        get_cancel_item: function() {
            return this.get('cancel_item');
        },
        set_consider_qty: function(val) {
            this.set('consider_qty', val)
        },
        get_consider_qty: function() {
            return this.get('consider_qty');
        },
        set_cancel_process: function(oid) {
            this.set('cancel_process', oid)
        },
        get_cancel_process: function() {
            return this.get('cancel_process');
        },
        set_cancel_item_id: function(val) {
            this.set('cancel_item_id', val)
        },
        get_cancel_item_id: function() {
            return this.get('cancel_item_id');
        },
        set_line_status: function(val) {
            this.set('line_status', val)
        },
        get_line_status: function() {
            return this.get('line_status');
        },
        set_location_id: function(location_id) {
            this.location_id = location_id;
        },
        get_location_id: function() {
            return this.location_id;
        },
        export_as_JSON: function() {
            var self = this;
            var lines = _super_orderline.export_as_JSON.call(this);
            var new_attr = {
                cancel_item: this.get_cancel_item() || false,
                cancel_process: this.get_cancel_process() || false,
                cancel_qty: this.get_quantity() || false,
                consider_qty: this.get_consider_qty() || false,
                cancel_item_id: this.get_cancel_item_id() || false,
                advance_pay : this.advance_pay ? this.advance_pay : false,
            }
            $.extend(lines, new_attr);
            return lines;
        },
    });

    screens.PaymentScreenWidget.include({
        get_total_paid_for_reservation : function(){
            var lines = this.pos.get_order().get_paymentlines();
            var total_amount = 0;
            for ( var i = 0; i < lines.length; i++ ) {
                total_amount = total_amount + lines[i].get_amount();
            }
            return (total_amount * -1);
        },
        reservation_partial_payment: function() {
            var self = this;
            var currentOrder = this.pos.get_order();

            if (currentOrder.get_total_with_tax() > 0 && currentOrder.get_due() != 0 && currentOrder.get_total_paid() != 0) {
                currentOrder.set_draft_order(true);
                if (!currentOrder.get_reserved_delivery_date()) {
                    self.gui.show_popup("delivery_date_popup", {
                        'payment_obj': self,
                        'new_date': true
                    });
                } else {
                    if (currentOrder.get_total_paid() != 0) {
                        var total_paid_for_reservation = self.get_total_paid_for_reservation();
                        var advance_pay_product = self.pos.db.get_product_by_id(self.pos.config.prod_for_payment[0]);
                        
                        var line_dict = {pos: self.pos, order: currentOrder, product: advance_pay_product};
                        var line = new models.Orderline({}, line_dict);
                        line.set_quantity(1);
                        line.set_unit_price(total_paid_for_reservation);
                        line.advance_pay = true;
                        currentOrder.reservation_ticket = true;
                        currentOrder.set_reservation_mode(true);
                        currentOrder.add_orderline(line);
                        self.finalize_validation();
                    }
                    $('.js_reservation_mode').removeClass('highlight');
                }
            }
        },
        renderElement: function() {
            var self = this;
            this._super();
            this.$('#partial_pay').click(function() {
                var order = self.pos.get_order();
                if (order.is_to_invoice()) {
                    alert(_t("You can't create invoice for reservation"));
                    return true;
                }
                if (!order.get_cancel_order()) {
                    if(is_pos_loyalty_amount_install && order.get_redeem_loyalty_amount() != 0){
                        alert(_t("You can't use loyalty for reservation"));
                        return true;
                    }
                    if(is_pos_gift_card_install && order.get_total_gift_card_redeem_amount() != 0){
                        alert(_t("You can't use gift card for reservation"));
                        return true;
                    }
                    if(is_pos_credit_voucher_install && order.get_total_credit_voucher_redeem_amount() != 0){
                        alert(_t("You can't use credit voucher for reservation"));
                        return true;
                    }
                    if (order.get_client()) {
                        self.reservation_partial_payment();
                    } else {
                        self.gui.show_screen('clientlist');
                    }
                }
            });
        },
        order_changes: function() {
            var self = this;
            this._super();
            var order = this.pos.get_order();
            var total = order ? order.get_total_with_tax() : 0;
            if (!order) {
                return
            } else if (order.get_due() == total || order.get_due() <= 0) {
                if(order.get_due() <= 0){
                    self.$('#validate_button').removeClass('oe_hidden');
                }  
                if (!order.get_cancel_order()) {
                    self.$('#partial_pay').removeClass('highlight');
                }
            } else {
                if (!order.get_cancel_order()) {
                    self.$('#partial_pay').addClass('highlight');
                    self.$('#validate_button').addClass('oe_hidden');
                }
            }
            if (order.get_cancel_order()) {
                self.$('#partial_pay').removeClass('highlight');
                self.$('#validate_button').removeClass('oe_hidden');
            }
        },
        validate_order: function(force_validation) {
            var order = this.pos.get_order();
            this.pos.get_order().set_reservation_mode(false);
            if (order.get_cancel_order()) {
                this.pos.get_order().set_reservation_mode(true);
            }
            this._super(force_validation);
        },
        show: function() {
            var self = this;
            self._super();
            var order = self.pos.get_order();
            if (order.get_reservation_mode()) {
                self.$('#partial_pay').show();
                self.$('#partial_pay').text("Reserve");
            }
        },
        click_back: function() {
            var self = this;
            var order = this.pos.get_order();
            if (order.get_paying_due() || order.get_cancel_order()) {
                this.gui.show_popup('confirm', {
                    title: _t('Discard Sale Order'),
                    body: _t('Do you want to discard the payment of POS ' + order.get_pos_reference() + ' ?'),
                    confirm: function() {
                        order.finalize();
                    },
                });
            } else {
                self._super();
            }
        },
        click_invoice: function() {
            var order = this.pos.get_order();
            if (order.get_cancel_order() || order.get_paying_due()) {
                return
            }
            this._super();
        },
        click_set_customer: function() {
            var order = this.pos.get_order();
            if (order.get_cancel_order() || order.get_paying_due()) {
                return
            }
            this._super();
        },
    });

    screens.OrderWidget.include({
        set_value: function(val) {
            var order = this.pos.get_order();
            var line = order.get_selected_orderline();
            if ($.inArray(line && line.get_product().id, [this.pos.config.prod_for_payment[0],
                    this.pos.config.refund_amount_product_id[0],
                    this.pos.config.cancellation_charges_product_id[0]
                ]) == -1) {
                this._super(val)
            }
        },
    });

    return {
        'DeliveryDatePopup': DeliveryDatePopup
    }

});