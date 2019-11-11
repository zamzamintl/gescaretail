odoo.define('pos_special_command.pos_special_command', function(require) {
    "use strict"

    var DB = require('point_of_sale.DB');
    var models = require('point_of_sale.models');
    var rpc = require('web.rpc');
    var PopupWidget = require('point_of_sale.popups');
    var PosReservation = require('pos_reservation.pos_reservation');
    var screens = require('point_of_sale.screens');

    models.load_fields("product.product", ['type']);

    models.PosModel.prototype.models.push({
        model: 'stock.picking.type',
        fields: [],
        domain: [
            ['code', '=', 'internal']
        ],
        loaded: function(self, stock_pick_typ) {
            self.stock_pick_typ = stock_pick_typ;
            self.db.add_picking_types(stock_pick_typ);
        },
    }, {
        model: 'stock.location',
        fields: [],
        domain: [
            ['usage', '=', 'internal']
        ],
        loaded: function(self, stock_location) {
            self.stock_location = stock_location;
        },
    });

    PosReservation.DeliveryDatePopup.include({
        show: function(options) {
            var self = this;
            PopupWidget.prototype.show.apply(this, arguments);
            var options = options || {};
            this.picking_types = self.pos.stock_pick_typ || [];
            this.location = self.pos.stock_location || [];
            if (options) {
                this.payment_obj = options.payment_obj;
                this.new_date = options.new_date;
                this.to_be_update_order = options.order;
                this.draft = options.draft;
            }
            var order = this.pos.get_order();
            self.renderElement();
            if (order.get_reserved_delivery_date()) {
                $('#delivery_datepicker').val(order.get_reserved_delivery_date());
            }
            // $('#delivery_datepicker').focus();
            $("#special_command").change(function() {
                if ($(this).prop("checked") == true) {
                    $(".internal_resrvation_transfer").show();
                    self.set_location_initial_value();
                } else {
                    $(".internal_resrvation_transfer").hide();
                }
            });
        },
        click_confirm: function() {
            var self = this;
            var order = this.pos.get_order();
            order.set_delivery_date($('#delivery_datepicker').val() || false);
            order.set_reserved_delivery_date($('#delivery_datepicker').val() || false);
            if (this.new_date) {
                if (!this.draft && this.payment_obj) {
                    if (order.get_total_paid() != 0) {
                        if ($("#special_command").prop("checked")) {
                            var total_paid_for_reservation = self.payment_obj.get_total_paid_for_reservation();
                            var advance_pay_product = self.pos.db.get_product_by_id(self.pos.config.prod_for_payment[0]);
                            
                            var line_dict = {pos: self.pos, order: order, product: advance_pay_product};
                            var line = new models.Orderline({}, line_dict);
                            line.set_quantity(1);
                            line.set_unit_price(total_paid_for_reservation);
                            line.advance_pay = true;
                            order.reservation_ticket = true;
                            order.set_reservation_mode(false);
                            order.add_orderline(line)
                            self.confirm_internal_resrvation_transfer();
                        } else {
                            var total_paid_for_reservation = self.payment_obj.get_total_paid_for_reservation();
                            var advance_pay_product = self.pos.db.get_product_by_id(self.pos.config.prod_for_payment[0]);
                            
                            var line_dict = {pos: self.pos, order: order, product: advance_pay_product};
                            var line = new models.Orderline({}, line_dict);
                            line.set_quantity(1);
                            line.set_unit_price(total_paid_for_reservation);
                            line.advance_pay = true;
                            order.reservation_ticket = true;
                            order.set_reservation_mode(true);
                            order.set_is_internal_reservation(false);
                            order.add_orderline(line);
                        }
                        self.payment_obj.finalize_validation();
                        $('.js_reservation_mode').removeClass('highlight');
                    }
                } else if (this.draft) {
                    var total_paid_for_reservation = self.payment_obj.get_total_paid_for_reservation();
                    var advance_pay_product = self.pos.db.get_product_by_id(self.pos.config.prod_for_payment[0]);
                    var line_dict = {pos: self.pos, order: order, product: advance_pay_product};
                    var line = new models.Orderline({}, line_dict);
                    line.set_quantity(1);
                    line.set_unit_price(total_paid_for_reservation);
                    line.advance_pay = true;
                    order.reservation_ticket = true;
                    order.add_orderline(line);
                    this.pos.push_order(order);
                    this.gui.show_screen('receipt');
                }
            } else {
                if (order && self.to_be_update_order.reserved_delivery_date != $('#delivery_datepicker').val()) {
                    rpc.query({
                        model: "pos.order",
                        method: "update_delivery_date",
                        args: [self.to_be_update_order.id, $('#delivery_datepicker').val()]
                    }).then(function(res){
                        self.pos.db.add_orders(res);
                        var temp_orders = self.pos.get('pos_order_list');
                        $.extend(temp_orders, res);
                        self.pos.set({
                            'pos_order_list': temp_orders
                        });
                    }, function(type,err){});
                }
            }
            this.gui.close_popup();
        },
        confirm_internal_resrvation_transfer: function() {
            var self = this;
            var selectedOrder = this.pos.get_order();
            var currentOrderLines = selectedOrder.get_orderlines();
            var moveLines = [];
            _.each(currentOrderLines, function(item) {
                if(item.product.type != 'service'){
                    var data = {};
                    var nm = item.product.default_code ? "[" + item.product.default_code + "]" + item.product.display_name : "";
                    data['product_id'] = item.product.id;
                    data['name'] = nm || item.product.display_name;
                    data['product_uom_qty'] = item.get_quantity();
                    data['location_id'] = Number($('#res_src_loc').val());
                    data['location_dest_id'] = Number($('#res_dest_loc').val());
                    data['product_uom'] = item.product.uom_id[0];
                    moveLines.push(data);
                }
            });
            var data = {};
            data['moveLines'] = moveLines;
            data['picking_type_id'] = Number($('#res_pick_type').val());
            data['location_src_id'] = Number($('#res_src_loc').val());
            data['location_dest_id'] = Number($('#res_dest_loc').val());
            data['state'] = $('#res_state').val();
            selectedOrder.set_internal_resveration_data(data);
            selectedOrder.set_is_internal_reservation(true);
        },
        set_location_initial_value: function() {
            var self = this;
            var pick_type = Number($('#res_pick_type').val());
            var selected_pick_type = self.pos.db.get_picking_type_by_id(pick_type);
            if (selected_pick_type && selected_pick_type.default_location_src_id[0]) {
                $('#res_src_loc').val(selected_pick_type.default_location_src_id[0]);
            }
            if (selected_pick_type && self.pos.config.reserve_stock_location_id) {
                $('#res_dest_loc').val(self.pos.config.reserve_stock_location_id[0]);
            }
            $('#res_pick_type').change(function() {
                var pick_type = Number($(this).val());
                var selected_pick_type = self.pos.db.get_picking_type_by_id(pick_type);
                if (selected_pick_type && selected_pick_type.default_location_src_id[0]) {
                    $('#res_src_loc').val(selected_pick_type.default_location_src_id[0]);
                }
                if (selected_pick_type && selected_pick_type.default_location_dest_id[0]) {
                    $('#res_dest_loc').val(selected_pick_type.default_location_dest_id[0]);
                }
            });
        }
    });

    DB.include({
        init: function(options) {
            this._super.apply(this, arguments);
            this.picking_type_by_id = {};
            this._super(options);
        },
        add_picking_types: function(stock_pick_typ) {
            var self = this;
            stock_pick_typ.map(function(type) {
                self.picking_type_by_id[type.id] = type;
            });
        },
        get_picking_type_by_id: function(id) {
            return this.picking_type_by_id[id];
        }
    });

    var _super_Order = models.Order.prototype;
    models.Order = models.Order.extend({
        initialize: function(attributes, options) {
            _super_Order.initialize.apply(this, arguments);
        },
        set_is_internal_reservation: function(state) {
            this.internal_reservation = state;
        },
        get_is_internal_reservation: function() {
            return this.internal_reservation;
        },
        set_internal_resveration_data: function(data) {
            this.res_move_lines = data['moveLines'];
            this.res_picking_type_id = data['picking_type_id'];
            this.res_location_src_id = data['location_src_id'];
            this.res_location_dest_id = data['location_dest_id'];
            this.res_state = data['state'];
            this.trigger('change', this);
        },
        get_internal_resveration_data: function() {
            var data = {};
            data['moveLines'] = this.res_move_lines;
            data['picking_type_id'] = this.res_picking_type_id;
            data['location_src_id'] = this.res_location_src_id;
            data['location_dest_id'] = this.res_location_dest_id;
            data['state'] = this.res_state;
            return data;
        },
        get_destination_name: function() {
            if (!this.res_location_dest_id) {
                return;
            }
            for (var i = 0; i < this.pos.stock_location.length; i++) {
                if (this.pos.stock_location[i].id === this.res_location_dest_id) {
                    return this.pos.stock_location[i].display_name
                }
            }
        },
        export_as_JSON: function() {
            var self = this;
            var json = _super_Order.export_as_JSON.call(this);
            json.internal_reservation = self.get_is_internal_reservation() ? true : false;
            json.internal_resveration_data = self.get_internal_resveration_data();
            return json;
        },
    });

    screens.PaymentScreenWidget.include({
        reservation_partial_payment: function() {
            var self = this;
            var currentOrder = this.pos.get_order();
            if (currentOrder.get_total_with_tax() > 0 && currentOrder.get_due() != 0 && currentOrder.get_total_paid() != 0) {
                currentOrder.set_draft_order(true);
                if (!currentOrder.get_reserved_delivery_date()) {
                    self.gui.show_popup("delivery_date_popup", {
                        'payment_obj': self,
                        'new_date': true
                    });
                } else {
                    if (currentOrder.get_total_paid() != 0) {
                        var total_paid_for_reservation = self.get_total_paid_for_reservation();
                        var advance_pay_product = self.pos.db.get_product_by_id(self.pos.config.prod_for_payment[0]);
                        
                        var line_dict = {pos: self.pos, order: currentOrder, product: advance_pay_product};
                        var line = new models.Orderline({}, line_dict);
                        line.set_quantity(1);
                        line.set_unit_price(total_paid_for_reservation);
                        line.advance_pay = true;
                        currentOrder.reservation_ticket = true;
                        if (currentOrder.get_is_internal_reservation()) {
                            currentOrder.set_reservation_mode(false);
                        } else {
                            currentOrder.set_reservation_mode(true);
                        }
                        currentOrder.add_orderline(line);
                        self.finalize_validation();
                    }
                    $('.js_reservation_mode').removeClass('highlight');
                }
            }
        },
    });

});