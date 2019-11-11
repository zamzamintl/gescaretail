odoo.define("pos_product_list_view.new_window_action", function(require) {

    var WebClient = require("web.WebClient");
    var session = require("web.session");

    WebClient.include({
        show_application: function() {
            var self = this;
            this.set_title();
            return $.when(this._super()).done(function() {
                if (window['redirect_action']) {
                    self.do_action(window['redirect_action']);
                    window['redirect_action'] = false;
                }
            })
        },
    });

});