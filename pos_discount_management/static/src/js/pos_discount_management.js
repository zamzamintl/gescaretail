odoo.define('pos_discount_management.pos_discount_management', function(require) {
    "use strict";

    var core = require('web.core');
    var chorme = require("point_of_sale.chrome");
    var models = require('point_of_sale.models');
    var PosBaseWidget = require('point_of_sale.BaseWidget');
    var screens = require('point_of_sale.screens');
    var session = require('web.session');

    var is_pos_quick_load_data_install = _.contains(session.module_list, 'pos_quick_load_data');

    models.load_fields("res.users", ['pos_changeprice_allowed', 'pos_discount_allowed']);
    models.load_fields("res.partner", ['pos_fixed_discount']);
    models.load_fields("product.product", ['pos_no_discount_allowed']);

    var _t = core._t;

    models.NumpadState = models.NumpadState.extend({
        defaults: {
            buffer: "0",
            mode: "price"
        },
        reset: function() {
            var user = null
            if (window.posmodel && window.posmodel.db) {
                user = window.posmodel.db.get_cashier();
            }
            var mode = 'price';
            if (user && !user.pos_changeprice_allowed) {
                mode = 'quantity';
            }
            this.set({
                buffer: "0",
                mode: mode
            });
        },
    });

    screens.NumpadWidget.include({
        init: function (parent) {
            this._super(parent);
            var user = this.pos.get_cashier()
            if (user.pos_changeprice_allowed) {
                this.state.changeMode('price');
            } else {
                this.state.changeMode('quantity');
            }
        },
        applyAccessRights: function() {
            var cashier = this.pos.get('cashier') || this.pos.get_cashier();
            var has_price_control_rights = cashier.pos_changeprice_allowed;
            var has_dicount_control_rights = cashier.pos_discount_allowed;
            this.$el.find('.mode-button[data-mode="price"]')
                .toggleClass('disabled-mode', !has_price_control_rights)
                .prop('disabled', !has_price_control_rights);
            this.$el.find('.mode-button[data-mode="discount"]')
                .toggleClass('disabled-mode', !has_dicount_control_rights)
                .prop('disabled', !has_dicount_control_rights);
            if ((!has_price_control_rights && this.state.get('mode') == 'price') ||
                (!has_dicount_control_rights && this.state.get('mode') == 'discount')) {
                this.state.changeMode('quantity');
            }
            if (has_price_control_rights) {
                this.state.changeMode('price');
            }else{
                this.state.changeMode('quantity');
            }
        },
    });

    var OrderDiscountInput = PosBaseWidget.extend({
        template: 'OrderDiscountInput',
        renderElement: function() {
            var self = this;
            this._super();
            self.$('.order_discount').val(this.pos.get_order().get_order_discount());
            self.$('.order_discount').off("keyup");
            self.$('.order_discount').off("keypress");
            self.$('.order_discount').on("keyup", function(e) {
                if ($(this).val().indexOf('.') == 0) {
                    $(this).val($(this).val().substring(1));
                }
                if (e.key == ".") {
                    return false;
                }
                var curr_order = self.pos.get_order();
                var order_discount = curr_order.get_order_discount();
                var input_order_disc_val = parseFloat($(this).val());
                if (order_discount <= input_order_disc_val) {
                    curr_order.set_order_discount(input_order_disc_val);
                }
            });
            self.$('.order_discount').on('keypress', function(e) {
                if (e.which != 8 && e.which != 0 && (e.which < 48 || e.which > 57) && (e.which != 46 || $(this).val().indexOf('.') != -1)) {
                    return false;
                }
            });
        },
    });

    screens.ProductScreenWidget.include({
        start: function() {
            var self = this;
            this._super();
            this.OrderDiscountInputWidget = new OrderDiscountInput(this, {});
            this.OrderDiscountInputWidget.prependTo(this.$('.leftpane .pads'));
        },
    });

    chorme.OrderSelectorWidget.include({
        renderElement: function() {
            var self = this;
            this._super();
            var order = self.pos.get_order();
            if (order && order.attributes.order_discount) {
                $("#order_discount").val(order.attributes.order_discount);
            } else {
                $("#order_discount").val(0);
            }
        },
    });

    var _super_order = models.Order.prototype;
    models.Order = models.Order.extend({
        initialize: function() {
            this.set({
                'order_discount': 0
            })
            _super_order.initialize.apply(this, arguments);
        },
        add_product: function(product, options) {
            var self = this;
            _super_order.add_product.apply(this, [product, options]);
            self.apply_order_discount();
        },
        set_client: function(client) {
            var self = this;
            if (client) {
                if (client.pos_fixed_discount != false && client.pos_fixed_discount >= 0) {
                    self.set_order_discount(client.pos_fixed_discount);
                } else {
                    self.set_order_discount(0);
                }
            } else {
                self.set_order_discount(0);
            }
            _super_order.set_client.apply(this, arguments);
        },
        init_from_JSON: function(json) {
            _super_order.init_from_JSON.apply(this, arguments);
            var self = this;
            if (!is_pos_quick_load_data_install) {
                self.set_order_discount(json.order_discount);
            }
        },
        apply_order_discount: function() {
            var self = this;
            var lines = this.get_orderlines();
            _.each(lines, function(line) {
                if (line.product && (line.order_id || line.product.pos_no_discount_allowed || self.is_ignore_prod(line.product.id))) {} else {
                    var order_discount = self.get_order_discount();
                    if (order_discount == 0) {
                        order_discount = line.get_discount();
                    }
                    var max_discount = Math.max(parseFloat(line.get_discount()), order_discount);
                    line.set_discount(max_discount);
                }
            })
        },
        apply_discount: function(discount) {
            var self = this;
            _.each(this.get_orderlines(), function(line) {
                //var max_discount = Math.max(parseFloat(discount),line.get_discount())
                if (line.product && (line.order_id || line.product.pos_no_discount_allowed || self.is_ignore_prod(line.product.id))) {} else {
                    var order_discount = self.get_order_discount();
                    var max_discount = Math.max(parseFloat(line.get_discount()), order_discount);
                    line.set_discount(max_discount);
                }
            });
        },
        set_order_discount: function(discount) {
            this.set('order_discount', parseFloat(discount));
            this.apply_discount(discount);
            this.trigger('change', this);
        },
        get_order_discount: function() {
            return this.get('order_discount');
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
        export_as_JSON: function(json) {
            var json = _super_order.export_as_JSON.apply(this, arguments);
            var self = this;
            json.order_discount = this.get_order_discount();
            return json;
        },
    });

    var _super_orderline = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        set_discount: function(discount) {
            if (this.product && this.product.pos_no_discount_allowed) {
                discount = 0;
            }
            var disc = Math.min(Math.max(parseFloat(discount) || 0, 0), 100);
            this.discount = disc;
            this.discountStr = '' + disc;
            this.trigger('change', this);
        },
    });

    var PosClearDiscount = screens.ActionButtonWidget.extend({
        template: 'PosClearDiscount',
        button_click: function() {
            var self = this;
            var order = self.pos.get_order();
            var lines = order.get_orderlines();
            if (lines.length === 0) {
                alert(_t("No product in order lsit"));
            }
            $("#order_discount").val(0);
            order.set('order_discount', parseFloat(0));
            _.each(order.get_orderlines(), function(line) {
                line.set_discount(0);
            });

        },
    });
    screens.define_action_button({
        'name': 'pos_clear_discount',
        'widget': PosClearDiscount,
        'condition': function() {
            return true;
        },
    });

});