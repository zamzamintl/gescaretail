odoo.define("pos_stock_grid.base_stock_grid", function(require) {
    "use strict"

    var web_editor_backend = require("web_editor.backend");

    web_editor_backend.FieldTextHtmlSimple.include({
        _render: function () {
            var res = this._super();
            var scrollArea = this.$el.find(".oe_measurestockview")[0];
            if(scrollArea){
                this.$el.find('table.scr').each(function(){
                    $(this).tableHeadFixer({"left" : 0, "foot" : false, "head" : true,"right" : 0})
                });
            }
            $.unblockUI();
            return res
        }
    });

});