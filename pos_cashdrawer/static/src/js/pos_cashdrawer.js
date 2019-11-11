odoo.define('pos_cashdrawer.cashdrawer', function(require) {
    "use strict";

    var chrome = require('point_of_sale.chrome');
    var PosBaseWidget = require('point_of_sale.BaseWidget');

    var OpenCashDrawerButton = PosBaseWidget.extend({
        template: 'OpenCashDrawerButton',
        start: function() {
            var self = this;
            this.$el.click(function() {
                self.pos.proxy.open_cashbox();
            });
        },
    });

    chrome.Chrome.prototype.widgets.unshift({
        'name': 'OpenCashDrawer',
        'widget': OpenCashDrawerButton,
        'append': '.pos-rightheader',
        'condition': function() {
            return this.pos.config.iface_cashdrawer;
        },
    });

});