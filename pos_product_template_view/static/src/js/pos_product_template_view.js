odoo.define("pos_product_template_view.pos_product_template_view", function(require) {
    "use strict"

    var core = require('web.core');
    var gui = require('point_of_sale.gui');
    var PopupWidget = require('point_of_sale.popups');
    var screens = require('point_of_sale.screens');
    var rpc = require('web.rpc');
    var _t = core._t;

    var ProductTemplatePopupWidget = PopupWidget.extend({
        template: 'ProductTemplatePopupWidget',
        show: function(options) {
            options = options || {};
            this.prod = options.prod || false;
            this._super(options);
            this.renderElement();
            if (this.prod && this.prod.id) {
                $.blockUI();
                rpc.query({
                    model: "product.template",
                    method: "pos_get_product_view",
                    args: [this.prod.id]
                }).then(function(grid) {
                    $('#product_template_view_id').html(grid);
                    $.unblockUI();
                });
            }
        },
    });
    gui.define_popup({
        name: 'product_template_view__popup',
        widget: ProductTemplatePopupWidget
    });

    var PosProductTemplate = screens.ActionButtonWidget.extend({
        template: 'ProductTemplateButton',
        button_click: function() {
            var self = this;
            var order = self.pos.get_order();
            var lines = order.get_orderlines();
            if (lines.length === 0) {
                alert(_t("No product selected !"));
            }
            if (self.pos.get_order().get_selected_orderline()) {
                var prod = self.pos.get_order().get_selected_orderline().get_product()
                self.gui.show_popup('product_template_view__popup', {
                    'prod': prod
                });
            }
        },
    });
    screens.define_action_button({
        'name': 'pos_product_template_view',
        'widget': PosProductTemplate,
        'condition': function() {
            return true;
        },
    });

});