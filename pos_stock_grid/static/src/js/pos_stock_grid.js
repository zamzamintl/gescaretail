odoo.define("pos_stock_grid.pos_stock_grid", function(require) {
    "use strict"

    var core = require('web.core');
    var gui = require('point_of_sale.gui');
    var models = require('point_of_sale.models');
    var rpc = require('web.rpc');
    var PopupWidget = require('point_of_sale.popups');
    var screens = require('point_of_sale.screens');
    var DB = require('point_of_sale.DB')

    var _t = core._t;

    var StockGridPopupWidget = PopupWidget.extend({
        template: 'StockGridPopupWidget',
        show: function(options) {
            options = options || {};
            this.prod = options.prod || false;
            this._super(options);
            this.renderElement();
            if (this.prod && this.prod.product_tmpl_id) {
                $.blockUI();
                rpc.query({
                    model: "product.template",
                    method: "pos_get_grid_stock_locations",
                    args: [this.prod.product_tmpl_id]
                }).then(function(grid){
                    $('#stock_grid_id').html(grid);
                    var scrollArea = $(".oe_measurestockview")[0];
                    if(scrollArea){
                        $('table.scr').each(function(){
                            $(this).tableHeadFixer({"left" : 0, "foot" : false, "head" : true,"right" : 0})
                        });
                    }
                    $.unblockUI();
                });
            }
        },
        renderElement: function() {
            var self = this;
            this._super();
        },
    });
    gui.define_popup({
        name: 'stock_grid_popup',
        widget: StockGridPopupWidget
    });

    var PosStockGrid = screens.ActionButtonWidget.extend({
        template: 'PosStockGridButton',
        button_click: function() {
            var self = this;
            var order = self.pos.get_order();
            var lines = order.get_orderlines();
            if (lines.length === 0) {
                alert(_t("No product selected !"));
            }
            if (self.pos.get_order().get_selected_orderline()) {
                var prod = self.pos.get_order().get_selected_orderline().get_product()
                self.gui.show_popup('stock_grid_popup', {
                    'prod': prod
                });
            }
        },
    });
    screens.define_action_button({
        'name': 'pos_stock_grid',
        'widget': PosStockGrid,
        'condition': function() {
            return true;
        },
    });

});