odoo.define('pos_chat.chrome', function(require) {
    "use strict";

    var chrome = require('point_of_sale.chrome');
    var core = require('web.core');
    var PosBaseWidget = require('point_of_sale.BaseWidget');
    var gui = require('point_of_sale.gui');
    var session = require('web.session')
    var is_enterprise = _.contains(session.module_list, 'web_enterprise');

    var QWeb = core.qweb;
    var _t = core._t;

    var MessageWidget = PosBaseWidget.extend({
        template: 'MessageWidget',
        events: {
            "click .pos-new_message": "on_click_new_message",
            "click .pos-filter": "on_click_filter",
            'click .o_mail_preview': 'onClickPreview',
        },
        renderElement: function() {
            var self = this;
            return this._super();
        },
        show: function(options) {
            options = options || {};
            var self = this;
            this._super(options);
            this.list = options.list || [];
            this.renderElement();
        },
        on_click_new_message: function() {
            var self = this;
            this.gui.close_popup();
            this.call('mail_service', 'openBlankThreadWindow');
            this._call_view()
        },
        on_click_filter: function(event) {
            event.stopPropagation();
            this.$(".pos-filter").removeClass('pos-selected');
            var $target = $(event.currentTarget);
            $target.addClass('pos-selected');
            this.filter = $target.data('filter');
            this._updatePreviews();
        },
        onClickPreview: function(ev) {
            var self = this
            var $target = $(ev.currentTarget);
            var previewID = $target.data('preview-id');

            if (previewID === 'mail_failure') {
                this._clickMailFailurePreview($target);
            } else if (previewID === 'mailbox_inbox') {
                var documentID = $target.data('document-id');
                var documentModel = $target.data('document-model');
                if (!documentModel) {
                    this._openDiscuss('mailbox_inbox');
                } else {
                    this._openDocument(documentModel, documentID);
                }
            } else {
                this.gui.close_popup();
                this.call('mail_service', 'openThread', previewID)
            }
        },
        _call_view: function() {
            var self = this;
            if (is_enterprise) {
                $('.o_thread_window_header').css("background-color", "#875A7B")
            }
        },
        getPreviews: function() {
            var self = this;
            return this.call('mail_service', 'getSystrayPreviews', self.filter);
        },
        _updatePreviews: function() {
            var self = this;
            this.getPreviews()
                .then(this._renderPreviews.bind(this));
        },
        _renderPreviews: function(previews) {
            this.$('.o_mail_navbar_dropdown_channels').html(QWeb.render('mail.systray.MessagingMenu.Previews', {
                previews: previews,
            }));
        },
        close: function() {
            if (this.$el) {
                this.$el.addClass('oe_hidden');
            }
        },
    });
    gui.define_popup({
        name: 'message',
        widget: MessageWidget
    });

    chrome.Chrome.include({
        events: {
            "click .pos-message": "on_click_pos_message",
        },
        build_widgets: function() {
            var self = this;
            this._super();
            if (self.pos.config.enable_pos_chat) {
                $('div.pos_chat').show();
            } else {
                $('div.pos_chat').hide();
            }
            if (is_enterprise) {
                $('.o_thread_window_header').css("background-color", "#875A7B")
            }
        },
        on_click_pos_message: function() {
            var self = this;
            if (this.gui.current_popup) {
                this.gui.close_popup();
            } else {
                this._updatePreviews();
            }
        },
        willStart: function() {
            return $.when(this._super.apply(this, arguments), this.call('mail_service', 'isReady'));
        },
        start: function() {
            var self = this;
            this.filter = false;
            this._updateCounter();
            var mailBus = this.call('mail_service', 'getMailBus');
            mailBus.on('activity_updated', this, this._updateCounter);
            mailBus.on('update_needaction', this, this._updateCounter);
            mailBus.on('new_channel', this, this._updateCounter);
            mailBus.on('update_thread_unread_counter', this, this._updateCounter);
            return this._super.apply(this, arguments);
        },
        renderElement: function() {
            var self = this;
            this.filter = false;
            return this._super();
        },
        _updateCounter: function() {
            var counter = this.computeCounter();
            this.$('.o_notification_counter').text(counter);
            this.$el.toggleClass('o_no_notification', !counter);
            if ($('.message-box').length > 0) {
                this._updatePreviews();
            }
        },
        computeCounter: function() {
            var channels = this.call('mail_service', 'getChannels');
            var channelUnreadCounters = _.map(channels, function(channel) {
                return channel.getUnreadCounter();
            });
            var unreadChannelCounter = _.reduce(channelUnreadCounters, function(acc, c) {
                return c > 0 ? acc + 1 : acc;
            }, 0);
            return unreadChannelCounter;
        },
        getPreviews: function() {
            var self = this;
            return this.call('mail_service', 'getSystrayPreviews', self.filter);
        },
        _updatePreviews: function() {
            var self = this;
            this.getPreviews()
                .then(this._renderPreviews.bind(this));
        },
        _renderPreviews: function(preview) {
            this.gui.show_popup('message', {
                list: preview
            });
        },
    });

});