odoo.define('pos_sale_user.pos_sale_user', function(require) {
    "use strict"

    var core = require('web.core');
    var models = require('point_of_sale.models');
    var _t = core._t;

    var _super_order = models.Order.prototype;
    models.Order = models.Order.extend({
        initialize: function() {
            var self = this;
            self.set({
                'sale_user_id': false,
                'sale_user': false,
            });
            _super_order.initialize.apply(this, arguments);
        },
        init_from_JSON: function(json) {
            _super_order.init_from_JSON.apply(this, arguments);
            var self = this;
            if (json.sale_user_id) {
                self.set('sale_user_id',json.sale_user_id);
            }
            if (json.sale_user) {
                self.set('sale_user',json.sale_user);
            }
        },
        get_sale_user_id: function(){
            return this.get('sale_user_id');
        },
        get_sale_user: function(){
            return this.get('sale_user');
        },
        export_as_JSON: function(){
            var json = _super_order.export_as_JSON.call(this);
            json.sale_user_id = this.get_sale_user_id() ? this.get_sale_user_id() : json.user_id;
            json.user_name = this.pos.cashier ? this.pos.cashier.name : this.pos.user.name;
            json.sale_user = this.get_sale_user() ? this.get_sale_user() : json.user_name;
            return json;
        }
    });

});