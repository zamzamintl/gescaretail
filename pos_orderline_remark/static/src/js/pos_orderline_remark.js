odoo.define('pos_orderline_remark.pos_orderline_remark', function(require) {
    "use strict"

    var core = require('web.core');
    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');
    var session = require('web.session');

    var _t = core._t;
    var is_pos_restaurant_install = _.contains(session.module_list, 'pos_restaurant');

    var _super_orderline = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        initialize: function(attr, options) {
            _super_orderline.initialize.call(this, attr, options);
            this.remark = this.remark || "";
            this.is_pos_restaurant_install = is_pos_restaurant_install;
        },
        set_remark: function(remark) {
            this.remark = remark;
            this.trigger('change', this);
        },
        get_remark: function(remark) {
            return this.remark;
        },
        generate_wrapped_product_name: function() {
            var MAX_LENGTH = 24; // 40 * line ratio of .6
            var wrapped = _super_orderline.generate_wrapped_product_name.apply(this, arguments);
            //For product comment wrapped
            if (this.remark && this.get_remark()) {
                if (this.get_remark().length > 0) {
                    var order_line_comment = (this.get_remark().length > 0) ? "Remark:(" + this.get_remark() + ")" : this.get_remark();
                    var current_order_line_comment = "";
                    while (order_line_comment.length > 0) {
                        var comment_space_index = 23; //name.indexOf(" ");
                        if (comment_space_index === -1) {
                            comment_space_index = order_line_comment.length;
                        }
                        if (current_order_line_comment.length + comment_space_index > MAX_LENGTH) {
                            if (current_order_line_comment.length) {
                                wrapped.push(current_order_line_comment);
                            }
                            current_order_line_comment = "";
                        }
                        current_order_line_comment += order_line_comment.slice(0, comment_space_index + 1);
                        order_line_comment = order_line_comment.slice(comment_space_index + 1);
                    }
                    if (current_order_line_comment.length) {
                        wrapped.push(current_order_line_comment);
                    }
                }
            }
            return wrapped;
        },
        can_be_merged_with: function(orderline) {
            if (orderline.get_remark() !== this.get_remark()) {
                return false;
            } else {
                return _super_orderline.can_be_merged_with.apply(this, arguments);
            }
        },
        clone: function() {
            var orderline = _super_orderline.clone.call(this);
            orderline.remark = this.remark;
            return orderline;
        },
        export_as_JSON: function() {
            var json = _super_orderline.export_as_JSON.call(this);
            json.remark = this.remark;
            return json;
        },
        init_from_JSON: function(json) {
            _super_orderline.init_from_JSON.apply(this, arguments);
            this.remark = json.remark;
        },
        export_for_printing: function() {
            var json = _super_orderline.export_for_printing.apply(this, arguments);
            json.remark = this.get_remark();
            return json;
        },
    });
    if (!is_pos_restaurant_install) {
        var OrderlineRemarkButton = screens.ActionButtonWidget.extend({
            template: 'OrderlineRemarkButton',
            button_click: function() {
                var line = this.pos.get_order().get_selected_orderline();
                if (line) {
                    this.gui.show_popup('textarea', {
                        title: _t('Add Remark'),
                        value: line.get_remark(),
                        confirm: function(remark) {
                            line.set_remark(remark);
                        },
                    });
                }
            },
        });
        screens.define_action_button({
            'name': 'orderline_remark',
            'widget': OrderlineRemarkButton,
            'condition': function() {
                return this.pos.config.orderline_remark;
            },
        });
    }

});