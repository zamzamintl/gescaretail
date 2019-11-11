odoo.define('princess_conditional_sale.princess_conditional_sale', function(require) {
    "use strict"

    var models = require('point_of_sale.models');
    var rpc = require('web.rpc');

    // models.load_fields('product.pricelist', ['product_conditional_discount_id']);
    models.load_fields('pos.order.line', ['has_conditional_discount']);

    var _super_order = models.Order.prototype;
    models.Order = models.Order.extend({
        remove_orderline: function(line) {
            var self = this;
            _super_order.remove_orderline.apply(this, [line]);
            self.compute_conditional_discount();
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
        apply_discount: function(discount) {
            _super_order.apply_discount.apply(this, arguments);
            this.compute_conditional_discount();
        },
        compute_conditional_discount: function() {
            var self = this;
            var order = this;
            var orderlines = order.export_as_JSON();
            var order_total = this.get_total_with_tax();
            if ('default_pricelist' in this.pos) {
                rpc.query({
                    model: "pos.order",
                    method: "get_conditional_discount_pos",
                    args: [orderlines, order_total]
                }).then(function(result) {
                    if (result != false) {
                        var lines = order.get_orderlines();
                        for (var j = 0; j < lines.length; j++) {
                            var flag = true;
                            for (var i = 0; i < result.length; i++) {
                                if (lines[j].order_id) {} else if (lines[j].product.id == result[i]['product_id']) {
                                    var order_discount = self.attributes.order_discount != undefined ? self.attributes.order_discount : 0;
                                    var max_discount = Math.max(parseFloat(result[i]['discount']), order_discount)
                                    max_discount = Math.max(parseFloat(lines[j].get_discount()), max_discount)
                                    lines[j].set_discount(max_discount);
                                    if (result[i]['discount']) {
                                        lines[j].set_has_conditional_discount(true);
                                    }
                                    flag = false;
                                }
                            }
                            if (flag) {
                                if (lines[j].product && (lines[j].order_id || lines[j].product.pos_no_discount_allowed || self.is_ignore_prod(lines[j].product.id))) {} else {
                                    var order_discount = self.attributes.order_discount != undefined ? self.attributes.order_discount : 0;
                                    if (order_discount == 0) {
                                        order_discount = lines[j].get_discount();
                                    }
                                    var max_discount = Math.max(parseFloat(lines[j].get_discount()), order_discount);
                                    lines[j].set_discount(max_discount);
                                }
                            }
                        }
                    } else {
                        var lines = order.get_orderlines();
                        _.each(lines, function(line) {
                            if (line.product && (line.order_id || line.product.pos_no_discount_allowed || self.is_ignore_prod(line.product.id))) {} else {
                                var order_discount = self.attributes.order_discount != undefined ? self.attributes.order_discount : 0;
                                if (order_discount == 0) {
                                    order_discount = line.get_discount();
                                }
                                var max_discount = Math.max(parseFloat(line.get_discount()), order_discount);
                                line.set_discount(max_discount);
                            }
                        })
                    }
                }, function(type, err) {});
            }
        },
        add_product: function(product, options) {
            var self = this;
            _super_order.add_product.apply(this, [product, options]);
            self.compute_conditional_discount();
        },
    });

    var _super_orderline = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        set_has_conditional_discount: function(has_condtional_discount) {
            this.has_condtional_discount = has_condtional_discount;
        },
        get_has_conditional_discount: function() {
            return this.has_condtional_discount;
        },
        set_quantity: function(quantity) {
            _super_orderline.set_quantity.apply(this, [quantity]);
            this.order.compute_conditional_discount();
        },
        export_as_JSON: function() {
            var json = _super_orderline.export_as_JSON.call(this);
            json.is_return_orderline = this.order_id ? true : false;
            json.has_conditional_discount = this.get_has_conditional_discount();
            return json;
        },
    });

});