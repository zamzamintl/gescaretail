odoo.define('pos_conditional_sale.web_waring', function(require) {
    "use strict"

    var core = require('web.core');
    var CrashManager = require('web.CrashManager');
    var Dialog = require('web.Dialog');

    var QWeb = core.qweb;
    var _t = core._t;

    CrashManager.include({
        show_warning: function(error) {
            if (!this.active) {
                return;
            }
            var self = this;
            var refresh = false;
            if (error && error.data && error.data.message &&
                error.data.message.indexOf('@@@@warning@@@@') != -1) {
                error.data.message = error.data.message.replace('@@@@warning@@@@', " ");
                refresh = true;
            }
            if (refresh) {
                new Dialog(this, {
                    size: 'medium',
                    title: _.str.capitalize(error.type || error.message) || _t("Odoo Warning"),
                    subtitle: error.data.title,
                    $content: $(QWeb.render('CrashManager.warning', {
                        error: error
                    })),
                    buttons: [{
                        text: ("Ok"),
                        click: function() {
                            this.close();
                            location.reload(true);
                        }
                    }]
                }).open({
                    shouldFocusButtons: true
                });
            } else {
                new Dialog(this, {
                    size: 'medium',
                    title: _.str.capitalize(error.type || error.message) || _t("Odoo Warning"),
                    subtitle: error.data.title,
                    $content: $(QWeb.render('CrashManager.warning', {
                        error: error
                    })),
                }).open({
                    shouldFocusButtons: true
                });
            }
        },
    });

});