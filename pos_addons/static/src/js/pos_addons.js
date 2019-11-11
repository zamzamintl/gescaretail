odoo.define("pos_addons.pos_addons", function(require) {
    "use strict"

    var core = require('web.core');
    var gui = require('point_of_sale.gui');
    var models = require('point_of_sale.models');
    var PopupWidget = require('point_of_sale.popups');
    var rpc = require('web.rpc');
    var screens = require('point_of_sale.screens');

    var _t = core._t;

    var _super_order = models.Order.prototype;
    models.Order = models.Order.extend({
        set_client: function (client) {
            var self = this;
            self.set_to_invoice(false);
            $('.js_invoice').removeClass('highlight');
            _super_order.set_client.apply(this, arguments);
        }
    });

    screens.PaymentScreenWidget.include({
        click_invoice: function () {
            var order = this.pos.get_order();
            var client = order.get_client();
            if (!client) {
                this.gui.show_popup('confirm',{
                    'title': _t('Please select the Customer'),
                    'body': _t('You need to select the customer before you can invoice an order.'),
                    confirm: function(){
                        this.gui.show_screen('clientlist');
                    }
                });
                return;
            }
            if (!client.vat) {
                this.gui.show_popup('confirm',{
                    'title': _t('No VAT number on customer'),
                    'body': _t('Please add a VAT number to the customer.'),
                    confirm: function(){
                        this.gui.show_screen('clientlist');
                    }
                });
                return;
            }
            order.set_to_invoice(!order.is_to_invoice());
            if (order.is_to_invoice()) {
                this.$('.js_invoice').addClass('highlight');
            } else {
                this.$('.js_invoice').removeClass('highlight');
            }
        }
    });

});