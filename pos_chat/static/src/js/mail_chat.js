odoo.define('pos_chat.Chat', function(require) {
    "use strict";

    var core = require('web.core');
    var threadWindow = require('mail.AbstractThreadWindow');
    var session = require('web.session')
    var is_enterprise = _.contains(session.module_list, 'web_enterprise');


    var QWeb = core.qweb;
    var _t = core._t;

    return threadWindow.include({
        template: "mail.AbstractThreadWindow",
        _getHeaderRenderingOptions: function() {
            this.url = this.el.baseURI.indexOf("pos/web")
            var vals = {
                status: this.getThreadStatus(),
                title: this.getTitle(),
                unreadCounter: this.getUnreadCounter(),
                widget: this,
                url: this.url,
            };
            if (this.url != -1) {
                vals['is_pos'] = true
            }
            return vals
        },
        renderHeader: function() {
            var options = this._getHeaderRenderingOptions();
            this.$header.html(
                QWeb.render('mail.AbstractThreadWindow.HeaderContent', options));
            if (options.is_pos && is_enterprise) {
                this.$header.css("background-color", "#875A7B")
            }
        },
    });


});