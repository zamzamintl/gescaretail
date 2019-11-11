odoo.define('pos_copy_ticket_number.pos_copy_ticket_number', function(require) {
    "use strict";

    var FormRenderer = require('web.FormRenderer');

    FormRenderer.include({
        _renderTagHeader: function(node) {
            var self = this;
            var $statusbar = this._super(node);
            if (self.state.model == 'pos.order') {
                $statusbar.find("#copy_ticket_number").remove();
                var $copy_ticket_number_btn = "<button id='copy_ticket_number' class='btn btn-sm'>Copy Ticket Number</button>";
                $statusbar.find(".o_statusbar_buttons").prepend($copy_ticket_number_btn);
                $statusbar.find("#copy_ticket_number").on('click', function() {
                    if (self.state && self.state.data) {
                        var data = self.state.data;
                        var pos_reference = data['pos_reference'];
                        if (pos_reference && pos_reference.toString().indexOf('Order') != -1) {
                            if (pos_reference.split("Order")[1]) {
                                pos_reference = pos_reference.split("Order")[1].trim(" ");
                            }
                        }
                        var el_input = document.createElement('input');
                        el_input.value = pos_reference;
                        $('body').prepend(el_input);
                        el_input.select();
                        document.execCommand('copy');
                        el_input.remove();
                        localStorage.setItem("copy_number", pos_reference);
                    }
                });
            }
            return $statusbar;
        },
    });

});