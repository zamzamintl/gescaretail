odoo.define('pos_block_validate.block_validate', function(require) {
    "use strict";

    var screens = require('point_of_sale.screens');
    var session = require('web.session');

    var is_pos_reservation_install = _.contains(session.module_list, 'pos_reservation');

    screens.PaymentScreenWidget.include({
        order_changes: function() {
            var self = this;
            this._super();
            var order = this.pos.get_order();
            var total = order ? order.get_total_with_tax() : 0;
            if (!order) {
                return
            } else if (order.get_due() <= 0) {
                self.$('.next').show()
            } else {
                self.$('.next').hide()
            }
            if (order.get_due() == total || order.get_due() <= 0) {
                if (is_pos_reservation_install && !order.get_cancel_order()) {
                    self.$('#partial_pay').hide()
                }
            } else {
                if (is_pos_reservation_install && !order.get_cancel_order()) {
                    self.$('#partial_pay').show()
                }
            }
            if (is_pos_reservation_install && order.get_cancel_order()) {
                self.$('#partial_pay').hide();
            }
        },
    });

});