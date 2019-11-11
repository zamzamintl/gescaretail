odoo.define('pos_rma.pos_rma', function(require) {
    "use strict";

    var core = require('web.core');
    var gui = require('point_of_sale.gui');
    var models = require('point_of_sale.models');
    var PopupWidget = require('point_of_sale.popups');
    var rpc = require('web.rpc');
    var screens = require('point_of_sale.screens');
    var session = require('web.session');

    var QWeb = core.qweb;
    var _t = core._t;

    var is_pos_conditional_install = _.contains(session.module_list, 'pos_conditional_sale');
    var is_pos_copy_ticket_number_install = _.contains(session.module_list, 'pos_copy_ticket_number');

    var _super_posmodel = models.PosModel;
    models.PosModel = models.PosModel.extend({
        // load the locally saved unpaid orders for this session.
        load_orders: function() {
            var jsons = this.db.get_unpaid_orders();
            var orders = [];
            var not_loaded_count = 0;
            for (var i = 0; i < jsons.length; i++) {
                var json = jsons[i];
                if (json.refund) {
                    this.db.remove_unpaid_order(json)
                } else {
                    if (json.pos_session_id === this.pos_session.id) {
                        orders.push(new models.Order({}, {
                            pos: this,
                            json: json,
                        }));
                    } else {
                        not_loaded_count += 1;
                    }
                }
            }
            if (not_loaded_count) {
                console.info('There are ' + not_loaded_count + ' locally saved unpaid orders belonging to another session');
            }
            orders = orders.sort(function(a, b) {
                return a.sequence_number - b.sequence_number;
            });
            if (orders.length) {
                this.get('orders').add(orders);
            }
        },
    });

    var ResetOrderButton = screens.ActionButtonWidget.extend({
        template: 'ResetOrderButton',
        button_click: function() {
            this.pos.get_order().destroy();
        },
    });

    var ReturnOrderButton = screens.ActionButtonWidget.extend({
        template: 'ReturnOrderButton',
        button_click: function() {
            this.gui.show_popup('PosReturnOrderOption');
        },
    });

    screens.define_action_button({
        'name': 'ResetOrderButton',
        'widget': ResetOrderButton,
        'condition': function() {
            return false;
        },
    });

    screens.define_action_button({
        'name': 'return_order_button',
        'widget': ReturnOrderButton,
        'condition': function() {
            return true;
        },
    });

    var _super_orderline = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        initialize: function(attr, options) {
            this.order_id = null;
            _super_orderline.initialize.call(this, attr, options);
        },
        set_quantity: function(quantity) {
            this.order.assert_editable();
            if (quantity === 'remove') {
                this.set_order_id('');
                this.order.remove_orderline(this);
                return;
            } else {
                _super_orderline.set_quantity.call(this, quantity);
            }
            this.trigger('change', this);
        },
        export_as_JSON: function() {
            var json = _super_orderline.export_as_JSON.call(this);
            json.return_process = this.get_order_id();
            json.return_qty = this.get_quantity();
            json.order_id = this.get_order_id();
            return json;
        },
        set_order_id: function(order_id) {
            this.order_id = order_id;
            this.set('order_id', order_id)
        },
        get_order_id: function() {
            return this.get('order_id');
        },
        can_be_merged_with: function(orderline) {
            var merged_lines = _super_orderline.can_be_merged_with.call(this, orderline);
            if (this.get_order_id()) {
                return false;
            } else if ((this.get_order_id() != orderline.get_order_id()) &&
                (this.get_product().id == orderline.get_product().id)) {
                return false;
            }
            return merged_lines;
        },
        merge: function(orderline) {
            if (this.get_order_id() || this.pos.get('selectedOrder').get_missing_mode()) {
                this.set_quantity(this.get_quantity() + orderline.get_quantity() * -1);
            } else {
                _super_orderline.merge.call(this, orderline);
            }
        },
    });

    var _super_order = models.Order.prototype;
    models.Order = models.Order.extend({
        initialize: function() {
            var self = this;
            self.set({
                'return_order_id': null,
                'sale_mode': false,
                'missing_mode': false,
                'whole_order': false,
                'order_state': 'draft',
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
        set_order_state: function(order_state) {
            this.set('order_state', order_state);
        },
        get_order_state: function() {
            return this.get('order_state');
        },
        set_whole_order: function(whole_order) {
            this.set('whole_order', whole_order);
        },
        get_whole_order: function() {
            return this.get('whole_order');
        },
        set_remaining_qty_tag: function(remaining_qty_tag) {
            this.remaining_qty_tag = remaining_qty_tag;
        },
        get_remaining_qty_tag: function() {
            return this.remaining_qty_tag;
        },
        set_return_order_id: function(return_order_id) {
            this.set('return_order_id', return_order_id)
        },
        get_return_order_id: function() {
            return this.get('return_order_id');
        },
        set_sale_mode: function(sale_mode) {
            this.set('sale_mode', sale_mode);
        },
        get_sale_mode: function() {
            return this.get('sale_mode');
        },
        set_missing_mode: function(missing_mode) {
            this.set('missing_mode', missing_mode);
        },
        get_missing_mode: function() {
            return this.get('missing_mode');
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
        add_pro: function(product, options) {
            var self = this;
            var line = new models.Orderline({}, {
                pos: this.pos,
                order: this,
                product: product
            });

            if (options.quantity !== undefined) {
                line.set_quantity(options.quantity);
            }

            if (options.price !== undefined) {
                line.set_unit_price(options.price);
            }

            //To substract from the unit price the included taxes mapped by the fiscal position
            this.fix_tax_included_price(line);

            if (options.discount !== undefined) {
                line.set_discount(options.discount);
            }

            if (options.extras !== undefined) {
                for (var prop in options.extras) {
                    line[prop] = options.extras[prop];
                }
            }

            var to_merge_orderline;
            for (var i = 0; i < this.orderlines.length; i++) {
                if (this.orderlines.at(i).can_be_merged_with(line) && options.merge !== false) {
                    to_merge_orderline = this.orderlines.at(i);
                }
            }
            if (to_merge_orderline) {
                to_merge_orderline.merge(line);
            } else {
                this.orderlines.add(line);
            }
            this.select_orderline(this.get_last_orderline());

            if (line.has_product_lot) {
                this.display_lot_popup();
            }
        },
        add_product: function(product, options) {
            var self = this;
            if (this._printed) {
                this.destroy();
                return this.pos.get_order().add_product(product, options);
            }
            this.assert_editable();
            options = options || {};
            var attr = JSON.parse(JSON.stringify(product));
            attr.pos = this.pos;
            attr.order = this;
            var is_sale_mode = this.get_sale_mode();
            var is_missing_mode = this.get_missing_mode();
            var return_order_id = self.pos.get_order().get_return_order_id();
            if (is_missing_mode) {
                var line = new models.Orderline({}, {
                    pos: attr.pos,
                    order: self,
                    product: product
                });
                if (return_order_id) {
                    line.set_order_id(return_order_id);
                }
                if (options.quantity !== undefined) {
                    line.set_quantity(options.quantity);
                }
                if (options.price !== undefined) {
                    line.set_unit_price(options.price);
                }
                if (options.discount !== undefined) {
                    line.set_discount(options.discount);
                }
                var last_orderline = this.get_last_orderline();
                if (last_orderline && last_orderline.can_be_merged_with(line) && options.merge !== false) {
                    last_orderline.merge(line);
                } else {
                    line.set_quantity(line.get_quantity() * -1)
                    this.add_orderline(line);
                }
                this.select_orderline(this.get_last_orderline());
            } else if (return_order_id) {
                var pids = [];
                var domain = [
                    ['order_id', '=', return_order_id],
                    ['product_id', '=', attr.id],
                    ['return_qty', '>', 0]
                ];
                rpc.query({
                        model: 'pos.order.line',
                        method: 'search_read',
                        args: [domain, []],
                    })
                    .then(function(result) {
                        if (result && result.length > 0) {
                            var return_qty = 0;
                            _.each(result, function(res) {
                                return_qty = return_qty + res.return_qty;
                            });
                            product['remaining_qty'] = return_qty
                            if (product.remaining_qty > 0 && self.pos.get_order().get_return_order_id()) {
                                self.pos.get_order().set_remaining_qty_tag(true);
                            } else {
                                self.pos.get_order().set_remaining_qty_tag(false);
                            }
                            if (return_qty > 0) {
                                var add_prod = true;
                                var added_item_count = 0;
                                (attr.order.orderlines).each(_.bind(function(item) {
                                    if (attr.id == item.get_product().id && item.get_order_id()) {
                                        added_item_count = added_item_count + (item.quantity * -1)
                                    }
                                    if (attr.id == item.get_product().id && return_qty <= added_item_count) {
                                        attr.pos.gui.show_popup('error', {
                                            'title': _t('Warning !'),
                                            'body': _t('Can not return more products !'),
                                        });
                                        add_prod = false;
                                    }
                                }, self));
                                if (add_prod) {
                                    var orderline_dict = {
                                        pos: attr.pos,
                                        order: self,
                                        product: product
                                    };
                                    var line = new models.Orderline({}, orderline_dict);
                                    line.set_order_id(return_order_id);
                                    if (result[0].discount) {
                                        line.set_discount(result[0].discount);
                                    }
                                    if (options.quantity !== undefined) {
                                        line.set_quantity(options.quantity);
                                    }
                                    if (options.price !== undefined) {
                                        line.set_unit_price(result[0].price_unit);
                                    }
                                    line.set_unit_price(result[0].price_unit);
                                    var last_orderline = attr.order.get_last_orderline();
                                    if (last_orderline && last_orderline.can_be_merged_with(line) && options.merge !== false) {
                                        last_orderline.merge(line);
                                    } else {
                                        line.set_quantity(line.get_quantity() * -1)
                                        attr.order.orderlines.add(line);
                                    }
                                    attr.order.select_orderline(attr.order.get_last_orderline());
                                }
                            } else {
                                attr.pos.gui.show_popup('error', {
                                    'title': _t('Warning !'),
                                    'body': _t('Please check quantity of selected product & sold product !'),
                                });
                                return;
                            }
                        } else {
                            self.add_pro(product, options);
                            if (is_pos_conditional_install) {
                                self.compute_conditional_discount();
                            }
                        }
                    }, function(type, err) {
                        def.reject();
                    });
            } else {
                _super_order.add_product.apply(this, arguments);
            }
        },
        export_for_printing: function() {
            var json = _super_order.export_for_printing.call(this);
            json.return_order_id = this.get_return_order_id
            return json;
        },
        export_as_JSON: function() {
            var json = _super_order.export_as_JSON.call(this);
            json.return_order = this.get_return_order_id() ? this.get_return_order_id() : '';
            json.refund = this.get_return_order_id() ? true : false;
            json.refund_invoice = this.get_refund_invoice() ? true : false;
            return json;
        },
        init_from_JSON: function(json) {
            _super_order.init_from_JSON.apply(this, arguments);
            json.return_order = json.return_order;
            json.refund = json.refund;
            if (json.refund) {
                this.set_return_order_id(json.return_order)
                this.refund = true
            } else {
                this.refund = false;
            }
        },
    });

    screens.OrderWidget.include({
        set_value: function(val) {
            var order = this.pos.get_order();
            if (order.get_selected_orderline()) {
                var mode = this.numpad_state.get('mode');
                var return_order_id = order.get_return_order_id();
                if (return_order_id) {
                    var prod_id = order.get_selected_orderline().get_product().id;
                    if (order.orderlines.length !== 0) {
                        if (mode === 'quantity') {
                            if (return_order_id && return_order_id.toString() != 'Missing Receipt' && val != 'remove') {
                                var self = this;
                                var pids = [];
                                var domain = [
                                    ['order_id', '=', return_order_id],
                                    ['product_id', '=', prod_id],
                                    ['return_qty', '>', 0]
                                ];
                                rpc.query({
                                        model: 'pos.order.line',
                                        method: 'search_read',
                                        args: [domain, ['return_qty', 'id']],
                                    })
                                    .then(function(result) {
                                        if (result && result.length > 0) {
                                            var add_prod = false;
                                            if (result[0].return_qty > 0) {
                                                add_prod = true;
                                                (order.orderlines).each(_.bind(function(item) {
                                                    if (prod_id == item.get_product().id &&
                                                        result[0].return_qty < parseInt(val)) {
                                                        self.pos.gui.show_popup('error', {
                                                            'title': _t('Warning !'),
                                                            'body': _t('Can not return more products !'),
                                                        });
                                                        add_prod = false;
                                                    }
                                                }));
                                            }
                                            if (add_prod) {
                                                if (val != 'remove') {
                                                    order.get_selected_orderline().set_quantity(parseInt(val) * -1);
                                                } else {
                                                    order.get_selected_orderline().set_quantity(val)
                                                }
                                            }
                                        } else {
                                            order.get_selected_orderline().set_quantity(val);
                                        }
                                    }, function(type, err) {
                                        def.reject();
                                    });
                            } else {
                                order.get_selected_orderline().set_quantity(val);
                            }
                        } else if (mode === 'discount') {
                            order.get_selected_orderline().set_discount(val);
                        } else if (mode === 'price') {
                            var selected_orderline = order.get_selected_orderline();
                            selected_orderline.price_manually_set = true;
                            selected_orderline.set_unit_price(val);
                        } else if (mode === 'pay') {
                            //  this._super(val);
                        }
                    } else {
                        order.destroy();
                    }
                } else {
                    this._super(val);
                }
            }
        },
    });

    screens.PaymentScreenWidget.include({
        validate_order: function(force_validation) {
            var self = this
            this._super(force_validation);
            self.pos.get_order().set_remaining_qty_tag(false);
        }
    });


    /*Return order oprtions*/
    var PosReturnOrderOption = PopupWidget.extend({
        template: 'PosReturnOrderOption',
        show: function(options) {
            var self = this;
            options = options || {};
            this._super(options);
            this.renderElement();
            $('.close_btn').click(function() {
                $('#return_order_ref').html('');
                $('#return_order_number').text('');
                self.gui.close_popup();
            });
            $('#choice_without_receipt').click(function(event) {
                var selectedOrder = self.pos.get_order();
                var cashregisters = self.pos.cashregisters;
                var is_cashdrawer = false;
                _.each(cashregisters, function(cashregister) {
                    if (cashregister.journal.is_cashdrawer && cashregister.journal.type === _t("cash")) {
                        is_cashdrawer = true;
                        return
                    }
                });
                if (selectedOrder) {
                    selectedOrder.set_sale_mode(false);
                    selectedOrder.set_missing_mode(true);
                    //selectedOrder.set_ret_o_ref('Missing Receipt');
                    $('#return_order_ref').html('Missing Receipt');
                    self.gui.close_popup();
                } else {
                    alert("Order not found...");
                }
            });
            $('#choice_with_receipt').click(function() {
                self.gui.close_popup();
                var selectedOrder = self.pos.get_order();
                selectedOrder.set_sale_mode(false);
                selectedOrder.set_missing_mode(false);
                $('#return_order_ref').html();
                self.gui.show_popup('pos_return_order');
            });
        },
    });
    gui.define_popup({
        name: 'PosReturnOrderOption',
        widget: PosReturnOrderOption
    });

    var PosReturnOrder = PopupWidget.extend({
        template: 'PosReturnOrder',
        init: function(parent, args) {
            var self = this;
            this._super(parent, args);
            this.options = {};
            this.line = [];
            this.update_qty = function(ev) {
                ev.preventDefault();
                var $link = $(ev.currentTarget);
                var $input = $link.parent().parent().find("input");
                var min = parseFloat($input.data("min") || 0);
                var max = parseFloat($input.data("max") || Infinity);
                var quantity = ($link.has(".fa-minus").length ? -1 : 1) + parseFloat($input.val(), 10);
                $input.val(quantity > min ? (quantity < max ? quantity : max) : min);
                $('input[name="' + $input.attr("name") + '"]').val(quantity > min ? (quantity < max ? quantity : max) : min);
                $input.change();
                return false;
            };
            this.keypress_order_number = function(e) {
                if (e.which === 13) {
                    var selectedOrder = self.pos.get_order();
                    var ret_o_ref = $("input#return_order_number").val();
                    var ret_o_ref_order = ret_o_ref;
                    if (ret_o_ref.indexOf('Order') == -1) {
                        ret_o_ref_order = _t('Order ') + ret_o_ref.toString();
                    }
                    if (ret_o_ref.length > 0) {
                        var order_domain = [
                            ['pos_reference', '=', ret_o_ref_order],
                            ['state', 'in', ['paid', 'done', 'invoiced']]
                        ];
                        rpc.query({
                                model: 'pos.order',
                                method: 'search_read',
                                args: [order_domain, ['id', 'pos_reference', 'partner_id', 'state','sale_user_id']],
                            })
                            .then(function(result) {
                                if (result && result.length > 0) {
                                    selectedOrder.set_return_order_id(result[0].id);
                                    //  selectedOrder.set_ret_o_ref(result[0].pos_reference);
                                    if (result[0].partner_id.length > 0) {
                                        selectedOrder.set_client(self.pos.db.get_partner_by_id(result[0].partner_id[0]));
                                    }
                                    selectedOrder.set_order_state(result[0].state);
                                    var sale_user_id = result[0].sale_user_id ? result[0].sale_user_id : false
                                    if(sale_user_id){
                                        if(sale_user_id[0]){
                                            selectedOrder.set('sale_user_id', sale_user_id[0])
                                        }
                                        if(sale_user_id[1]){
                                            selectedOrder.set('sale_user', sale_user_id[1])
                                        }
                                    }
                                    var orderline_domain = [
                                        ['order_id', '=', result[0].id],
                                        ['return_qty', '>', 0]
                                    ];
                                    rpc.query({
                                            model: 'pos.order.line',
                                            method: 'search_read',
                                            args: [orderline_domain],
                                        })
                                        .then(function(res) {
                                            if (res && res.length > 0) {
                                                var lines = [];
                                                _.each(res, function(r) {
                                                    if (r.return_qty > 0) {
                                                        if (!selectedOrder.is_ignore_prod(r.product_id[0])) {
                                                            var product = self.pos.db.get_product_by_id(r.product_id[0]);
                                                            (selectedOrder.orderlines).each(_.bind(function(line) {
                                                                if (product.id == line.get_product().id &&
                                                                    line.get_order_id()
                                                                ) {
                                                                    r.return_qty = r.return_qty - (line.quantity * -1);
                                                                    r.qty = r.return_qty;
                                                                }
                                                            }));
                                                            if (r.return_qty > 0) {
                                                                lines.push(r);
                                                                self.line[r.id] = r;
                                                            }
                                                        }
                                                        //   if(!selectedOrder.is_ignore_prod(r.product_id[0])){
                                                        //    if(!selectedOrder.is_ignore_prod(r.product_id[0])){
                                                        //                                                lines.push(r);
                                                        //                                                self.line[r.id] = r;
                                                        //  }
                                                    }
                                                });
                                                self.lines = lines;
                                                self.renderElement();
                                                $('#return_whole_order').prop('disabled', false);
                                                if (self.lines.length == 1) {
                                                    $('.ac_selected_product').prop('checked', true);
                                                    $('#return_whole_order').prop('checked', true);
                                                }
                                            } else {
                                                alert(_t("No item found"));
                                            }
                                        }, function(type, err) {
                                            def.reject();
                                        });
                                } else {
                                    $('input#return_order_number').val('');
                                    $('.ac_return_product_list').empty();
                                    alert(_t("No result found"));
                                }
                            }, function(type, err) {
                                def.reject();
                            });
                    }
                }
            };
            this.keydown_qty = function(e) {
                if ($(this).val() > $(this).data('max')) {
                    $(this).val($(this).data('max'))
                }
                if ($(this).val() < $(this).data('min')) {
                    $(this).val($(this).data('min'))
                }
            };
            this.return_whole_order = function(e) {
                if ($('.ac_selected_product').prop('checked')) {
                    $('.ac_selected_product').prop('checked', false);
                } else {
                    $('.ac_selected_product').prop('checked', true);
                }
                _.each($('.product_content'), function(box) {
                    if ($(box).find('.js_quantity').data('max')) {
                        $(box).find('.js_quantity').val($(box).find('.js_quantity').data('max'));
                    }
                });
                //              $('.ac_return_product_list div.product-name').find('.js_quantity').val($('.ac_return_product_list div.product-name').find('.js_quantity').data('max'));
            };
            this.copy_number = function(e) {
                var ref = localStorage.getItem('copy_number');
                $("input#return_order_number").val(ref);
                $("input#return_order_number").focus();
            };
        },
        show: function(options) {
            options = options || {};
            this._super(options);
            this.renderElement();
            $("input#return_order_number").focus();
            $('.ac_return_product_list').empty();
            if (!is_pos_copy_ticket_number_install) {
                this.$('.footer .paste').hide();
            }
        },
        click_confirm: function() {
            var self = this;
            var ret_o_ref = $("input#return_order_number").val();
            var selectedOrder = this.pos.get_order();
            if ($('#return_whole_order').prop('checked')) {
                selectedOrder.set_whole_order(true);
            }
            if (selectedOrder.get_return_order_id()) {
                _.each($('.ac_selected_product'), function(item) {
                    if ($(item).prop('checked')) {
                        var orderline = self.line[$(item).data('name')];
                        if (orderline) {
                            var product = self.pos.db.get_product_by_id(orderline.product_id[0]);
                            var orderline_dict = {
                                pos: self.pos,
                                order: selectedOrder,
                                product: product
                            }
                            if (orderline.property_description_str_ids && orderline.property_description_str_ids.length >= 0) {
                                var ids = orderline.property_description_str_ids.split(",");
                                orderline_dict = {
                                    pos: self.pos,
                                    order: selectedOrder,
                                    product: product,
                                    descrip: orderline.property_description,
                                    description_ids: ids
                                };
                            }
                            var line = new models.Orderline({}, orderline_dict);
                            line.set_quantity($('input[name="' + orderline.id + '"').val() * -1);
                            line.set_unit_price(orderline.price_unit);
                            line.set_order_id(orderline.order_id[0]);
                            if (orderline.discount) {
                                line.set_discount(orderline.discount);
                            }
                            // line.set_back_order(selectedOrder.get_ret_o_ref());
                            selectedOrder.add_orderline(line);
                        }
                    }
                });
                //  $('#return_order_ref').html(selectedOrder.get_ret_o_ref());
                $('.ac_selected_product').prop('checked', false);
                this.gui.close_popup();
            } else {
                $("input#return_order_number").focus();
                alert(_t('Please press enter to view order'));
            }
        },
        click_cancel: function() {
            $('.ac_selected_product').prop('checked', false);
            //    this.pos.get_order().destroy()
            this.pos.get_order().set('sale_user_id',false)
            this.pos.get_order().set('sale_user',false)
            this.gui.close_popup();
        },
        get_product_image_url: function(product_id) {
            return window.location.origin + '/web/image?model=product.product&field=image_medium&id=' + product_id;
        },
        renderElement: function() {
            this._super();
            this.$('.input-group-addon').delegate('a.js_qty', 'click', this.update_qty);
            this.$('div.content').delegate('#return_order_number', 'keypress', this.keypress_order_number);
            this.$('div.input-group').delegate('.js_quantity', 'input', this.keydown_qty);
            this.$('div.whole_order').delegate('#return_whole_order', 'change', this.return_whole_order); // open if use bonus
            this.$('div.footer').delegate('#paste', 'click', this.copy_number);
        },
    });
    gui.define_popup({
        name: 'pos_return_order',
        widget: PosReturnOrder
    });

});