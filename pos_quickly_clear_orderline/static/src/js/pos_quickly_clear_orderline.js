odoo.define("pos_quickly_clear_orderline.pos_quickly_clear_orderline", function(require) {
    "use strict"

    var core = require('web.core');
    var screens = require('point_of_sale.screens');

    var QWeb = core.qweb;

    screens.OrderWidget.include({
        render_orderline: function(orderline) {
            var self = this;
            var el_str = QWeb.render('Orderline', {
                widget: this,
                line: orderline
            });
            var el_node = document.createElement('div');
            el_node.innerHTML = _.str.trim(el_str);
            el_node = el_node.childNodes[0];
            el_node.orderline = orderline;
            el_node.addEventListener('click', this.line_click_handler);
            var el_remove_icon = el_node.querySelector('.line-remove-icon');
            if (el_remove_icon) {
                el_remove_icon.addEventListener('click', (function() {
                    var order = self.pos.get_order();
                    if (order) {
                        order.remove_orderline(orderline);
                    }
                }.bind(this)));
            }
            var el_lot_icon = el_node.querySelector('.line-lot-icon');
            if (el_lot_icon) {
                el_lot_icon.addEventListener('click', (function() {
                    this.show_product_lot(orderline);
                }.bind(this)));
            }
            orderline.node = el_node;
            return el_node;
        },
    });

});