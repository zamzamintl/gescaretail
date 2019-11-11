odoo.define('pos_gift_card.GiftCard', function(require) {
    "use strict";

    var ajax = require('web.ajax');
    var core = require('web.core');
    var DB = require('point_of_sale.DB');
    var gui = require('point_of_sale.gui');
    var models = require('point_of_sale.models');
    var PopupWidget = require('point_of_sale.popups');
    var rpc = require('web.rpc');
    var screens = require('point_of_sale.screens');
    var utils = require('web.utils');

    var round_di = utils.round_decimals;

    var QWeb = core.qweb;
    var _t = core._t;

    models.load_fields("res.partner", ['remaining_amount']);
    models.load_fields("account.journal", ['pos_front_display']);

    var PosGiftCardButton = screens.ActionButtonWidget.extend({
        template: 'PosGiftCardButton',
        button_click: function() {
            var self = this;
            self.gui.show_popup('create_card_popup');
        }
    });

    screens.define_action_button({
        'name': 'pos_gift_card',
        'widget': PosGiftCardButton,
        'condition': function() {
            return this.pos.config.enable_gift_card;
        },
    });

    var CreateCardPopupWidget = PopupWidget.extend({
        template: 'CreateCardPopupWidget',
        events: _.extend({}, PopupWidget.prototype.events, {
            'click .button.multiple_card': 'multiple_card',
        }),
        multiple_card: function() {
            $("#card_no_tr").hide();
            $("#number_of_card").show();
            $("#checkbox_print_gift_card").attr('checked', true);
        },
        show: function(options) {
            var self = this;
            self.partner_id = '';
            self.partner_name = '';
            options = options || {};
            self.panding_card = options.card_data || false;
            var order = self.pos.get_order();
            if (order && order.get_client()) {
                self.partner_id = order.get_client().id;
                self.partner_name = order.get_client().name;
            }

            function zero_pad(num, size) {
                var s = "" + num;
                while (s.length < size) {
                    s = "0" + s;
                }
                return s;
            }
            var expire_date = new Date();
            expire_date.setMonth(expire_date.getMonth() + 6);

            var year = expire_date.getFullYear();
            var month = zero_pad(expire_date.getMonth() + 1, 2);
            var day = zero_pad(expire_date.getDate(), 2);
            self.expire_date = day + "/" + month + "/" + year;

            this._super(options);
            this.renderElement();
            $('#card_no').focus();
            var timestamp = new Date().getTime() / 1000;
            var partners = this.pos.db.partner_by_id; //this.pos.partners;
            var partners_list = [];
            if (partners) {
                _.each(partners, function(partner) {
                    partners_list.push({
                        'id': partner.id,
                        'value': partner.name,
                        'label': partner.name,
                    });
                })
                $('#select_customer').keypress(function(e) {
                    $('#select_customer').autocomplete({
                        source: partners_list,
                        select: function(event, ui) {
                            self.partner_id = ui.item.id;
                            $('span.ui-helper-hidden-accessible').html("");
                            $('ul.ui-autocomplete').css('display', 'none');
                        },
                    });
                    $('span.ui-helper-hidden-accessible').html("");
                    $('ul.ui-autocomplete').css('display', 'none');
                });
            }
            $("#text_amount,#number_of_card_input").keypress(function(e) {
                if (e.which != 8 && e.which != 0 && (e.which < 48 || e.which > 57) && e.which != 46) {
                    return false;
                }
            });
            // $('#card_no').html(window.parseInt(timestamp));
            if (self.pos.config.manual_card_number && !self.panding_card) {
                $("#card_no").keypress(function(e) {
                    if (e.which != 8 && e.which != 0 && (e.which < 48 || e.which > 57) && e.which != 46) {
                        return false;
                    }
                });
            } else if (!self.panding_card) {
                //  $('#card_no').val(window.parseInt(timestamp));
            }
            var partner = null;
            for (var j = 0; j < self.pos.partners.length; j++) {
                partner = self.pos.partners[j];
                self.partner = this.partner
            }
        },
        set_gift_card_data: function(input_amount, card_no) {
            var self = this;
            var order = self.pos.get_order();
            var checkbox_print_gift_card = document.getElementById("checkbox_print_gift_card");
            var expire_date = this.$('#text_expire_date').val();
            var expire_date_format = expire_date;
            var select_customer = self.partner_id;
            var client = order.get_client();
            expire_date = moment(expire_date, 'DD/MM/YYYY');
            expire_date = moment(expire_date).format("YYYY-MM-DD");
            var gift_order = {
                'giftcard_card_no': card_no,
                'giftcard_customer': client ? client.id : false,
                'giftcard_expire_date': expire_date,
                'giftcard_expire_date_format': expire_date_format,
                'giftcard_amount': input_amount,
                'giftcard_customer_name': $("#select_customer").val(),
                'giftcard_issue_date': new Date(),
            }
            order.set_giftcard(gift_order);
            order.set_print_gift_card(checkbox_print_gift_card.checked);
        },
        click_confirm: function() {
            var self = this;
            var order = self.pos.get_order();
            var expire_date = this.$('#text_expire_date').val();
            var card_no = $('#card_no').val();
            var select_customer = self.partner_id;
            var number_of_card_input = parseInt($('#number_of_card_input').val());
            //            if (!$('#select_customer').val()) {
            //                alert("Please select customer.");
            //                $('#select_customer').focus();
            //            } else {
            // if (self.partner_id) {
            var client = order.get_client();
            // var client = self.pos.db.get_partner_by_id(self.partner_id);
            if (expire_date) {
                $('#text_amount').focus();
                var input_amount = this.$('#text_amount').val();
                if (input_amount) {
                    if (number_of_card_input) {
                        //    order.set_client(client);
                        var product = self.pos.db.get_product_by_id(self.pos.config.gift_card_product_id[0]);
                        if (product) {
                            order.add_product(product);
                            var selected_line = order.get_selected_orderline();
                            if (selected_line) {
                                selected_line.set_quantity(number_of_card_input);
                                selected_line.set_unit_price(input_amount);
                                selected_line.price_manually_set = true;
                            }
                        }
                        for (var i = 0; i < number_of_card_input; i++) {
                            var timestamp = new Date().getTime();
                            self.set_gift_card_data(input_amount, window.parseInt(timestamp));
                        }
                        self.gui.show_screen('products');
                        $("#card_back").hide();
                        $("div.js_set_customer").off("click");
                        $("div#card_invoice").off("click");
                        this.gui.close_popup();
                    } else if (card_no) {
                        //    order.set_client(client);
                        var product = self.pos.db.get_product_by_id(self.pos.config.gift_card_product_id[0]);
                        if (product) {
                            order.add_product(product);
                            var selected_line = order.get_selected_orderline();
                            if (selected_line) {
                                selected_line.set_unit_price(input_amount);
                                selected_line.price_manually_set = true;
                            }
                        }
                        self.set_gift_card_data(input_amount, card_no);
                        self.gui.show_screen('products');
                        $("#card_back").hide();
                        $("div.js_set_customer").off("click");
                        $("div#card_invoice").off("click");
                        this.gui.close_popup();
                    } else if (!number_of_card_input) {
                        alert("Please enter number of card.")
                        $('#card_no').focus();
                    } else if (!card_no) {
                        alert("Please select card number.")
                        $('#card_no').focus();
                    }
                } else {
                    alert("Please enter card value.")
                    $('#text_amount').focus();
                }
            } else {
                alert("Please select expire date.")
                $('#text_expire_date').focus();
            }
            //                } else {
            //                    alert("Please select customer.");
            //                    $('#select_customer').focus();
            //                }
            //            }

        },

        renderElement: function() {
            var self = this;
            this._super();
            $('.datetime').datetimepicker({
                minDate: moment(),
                format: 'DD/MM/YYYY',
                pickTime: false,
                icons: {
                    time: 'fa fa-clock-o',
                    date: 'fa fa-calendar',
                    up: 'fa fa-chevron-up',
                    down: 'fa fa-chevron-down'
                },
            });
        },
    });
    gui.define_popup({
        name: 'create_card_popup',
        widget: CreateCardPopupWidget
    });

    var _super_Order = models.Order.prototype;
    models.Order = models.Order.extend({
        initialize: function(attributes, options) {
            this.set({
                gift_receipt_mode: false,
            });
            this.giftcard = [];
            this.print_gift_card = false;
            this.redeem = [];
            this.total_gift_card_redeem_amount = 0;
            _super_Order.initialize.apply(this, arguments);
        },
        export_as_JSON: function() {
            var json = _super_Order.export_as_JSON.apply(this, arguments);
            json.giftcard = this.get_giftcard();
            json.redeem = this.get_redeem_giftcard();
            json.print_gift_card = this.get_print_gift_card();
            json.total_gift_card_redeem_amount = this.get_total_gift_card_redeem_amount();
            json.pos_reference = this.get('pos_reference') ? this.get('pos_reference') : this.get_name();
            return json;
        },
        init_from_JSON: function(json) {
            _super_Order.init_from_JSON.apply(this, arguments);
            if (json.giftcard && json.giftcard[0]) {
                this.set_giftcard(json.giftcard[0]);
            }
            if (json.redeem && json.redeem[0]) {
                this.set_redeem_giftcard(json.redeem[0]);
            }
            if (json.print_gift_card) {
                this.set_print_gift_card(json.print_gift_card);
            }
            if (json.total_gift_card_redeem_amount) {
                this.set_total_gift_card_redeem_amount(json.total_gift_card_redeem_amount);
            }
        },
        set_total_gift_card_redeem_amount: function(gift_card_redeem_amount) {
            this.total_gift_card_redeem_amount = this.total_gift_card_redeem_amount + gift_card_redeem_amount;
            this.trigger('change', this);
        },
        get_total_gift_card_redeem_amount: function() {
            return this.total_gift_card_redeem_amount;
        },
        set_giftcard: function(giftcard) {
            if (giftcard && giftcard != 'null' && giftcard != undefined) {
                this.giftcard.push(giftcard);
            } else {
                this.giftcard = [];
            }
            this.trigger('change', this);
        },
        get_giftcard: function() {
            return this.giftcard;
        },
        set_print_gift_card: function(giftcard) {
            this.print_gift_card = giftcard;
            this.trigger('change', this);
        },
        get_print_gift_card: function() {
            return this.print_gift_card;
        },
        set_redeem_giftcard: function(redeem) {
            if (redeem && redeem != 'null' && redeem != undefined) {
                this.redeem.push(redeem);
            } else {
                this.redeem = [];
            }
            this.trigger('change', this);
        },
        get_redeem_giftcard: function() {
            return this.redeem;
        },
        remove_paymentline: function(line) {
            if (line && line.get_payment_redeem_giftcard().length != 0) {
                this.remove_card(line.get_payment_redeem_giftcard())
                this.set_total_gift_card_redeem_amount(-line.get_gift_redeem_amount());
            }
            _super_Order.remove_paymentline.apply(this, arguments);
        },
        remove_card: function(code) {
            var self = this;
            if (this.redeem && this.redeem.length > 0 && code && code.length > 0) {
                _.each(code, function(cd) {
                    var index = self.redeem.indexOf(cd);
                    if (index > -1) {
                        self.redeem.splice(index, 1);
                        self.trigger('change', self);
                    }
                });
            }
        },
        export_for_printing: function() {
            var json = _super_Order.export_for_printing.apply(this, arguments);
            var order = this;

            var order_giftcards = order.get_giftcard();
            var print_gift_card = order.get_print_gift_card();
            var gift_card_details = {};
            var gift_card_src = false;
            _.each(order_giftcards, function(order_giftcard) {
                var bar_val = order_giftcard;
                if (bar_val && print_gift_card) {
                    var barcode = bar_val.giftcard_card_no;
                    if (barcode) {
                        var barcode_val = barcode.toString();
                        var barcodeTemplate = QWeb.render('giftbarcode', {
                            widget: this,
                            barcode: barcode_val
                        });
                        $(barcodeTemplate).find('#barcode_giftcard').removeClass(barcode.toString());
                        $(barcodeTemplate).find('#barcode_giftcard').barcode(barcode_val.toString(), "code128");
                        if (_.isElement($(barcodeTemplate).find('#barcode_giftcard').barcode(barcode_val.toString(), "code128")[0])) {
                            if ($(barcodeTemplate).find('#barcode_giftcard').barcode(barcode_val.toString(), "code128")[0].firstChild != undefined &&
                                $(barcodeTemplate).find('#barcode_giftcard').barcode(barcode_val.toString(), "code128")[0].firstChild.data != undefined) {
                                gift_card_src = $(barcodeTemplate).find('#barcode_giftcard').barcode(barcode_val.toString(), "code128")[0].firstChild.data;
                            }
                        }
                        gift_card_details[barcode] = {
                            'data': [order_giftcard],
                            'src': gift_card_src,
                            'card_no': barcode
                        }
                    }
                }
            });

            var order_redeem_giftcards = order.get_redeem_giftcard();
            var redeem_giftcard_details = {};
            var redeem_giftcard_src = false;
            _.each(order_redeem_giftcards, function(order_redeem_giftcard) {
                var bar_val = order_redeem_giftcard;
                if (bar_val) {
                    var barcode = bar_val.redeem_card;
                    if (barcode) {
                        if (Number(order_redeem_giftcard.redeem_remaining) > 0) {
                            var barcode_val = barcode.toString();
                            var barcodeTemplate = QWeb.render('giftbarcode', {
                                widget: this,
                                barcode: barcode_val
                            });
                            $(barcodeTemplate).find('#barcode_giftcard').removeClass(barcode.toString());
                            $(barcodeTemplate).find('#barcode_giftcard').barcode(barcode_val.toString(), "code128");
                            if (_.isElement($(barcodeTemplate).find('#barcode_giftcard').barcode(barcode_val.toString(), "code128")[0])) {
                                if ($(barcodeTemplate).find('#barcode_giftcard').barcode(barcode_val.toString(), "code128")[0].firstChild != undefined &&
                                    $(barcodeTemplate).find('#barcode_giftcard').barcode(barcode_val.toString(), "code128")[0].firstChild.data != undefined) {
                                    redeem_giftcard_src = $(barcodeTemplate).find('#barcode_giftcard').barcode(barcode_val.toString(), "code128")[0].firstChild.data;
                                }
                            }
                            redeem_giftcard_details[barcode] = {
                                'data': [order_redeem_giftcard],
                                'src': redeem_giftcard_src,
                                'card_no': barcode
                            }
                        } else {
                            delete redeem_giftcard_details[barcode];
                        }
                    }
                }
            });
            json.gift_card_details = gift_card_details;
            json.redeem_giftcard_details = redeem_giftcard_details;
            return json;
        },
    });

    var _super_paymentline = models.Paymentline.prototype;
    models.Paymentline = models.Paymentline.extend({
        initialize: function(attributes, options) {
            var self = this;
            this.payment_charge = 0;
            this.code = false;
            this.redeem = [];
            this.gift_redeem_amount = 0;
            _super_paymentline.initialize.apply(this, arguments);
        },
        init_from_JSON: function(json) {
            _super_paymentline.init_from_JSON.apply(this, arguments);
            this.set_giftcard_line_code(json.code)
            this.set_payment_charge(json.payment_charge);
            this.gift_redeem_amount = json.gift_redeem_amount;
            if (json.redeem && json.redeem[0]) {
                this.set_payment_redeem_giftcard(json.redeem[0]);
            }
        },
        set_gift_redeem_amount: function(value) {
            this.gift_redeem_amount = round_di(parseFloat(value) || 0, this.pos.currency.decimals);
            this.trigger('change', this);
        },
        get_gift_redeem_amount: function() {
            return this.gift_redeem_amount;
        },
        export_as_JSON: function() {
            var json = _super_paymentline.export_as_JSON.apply(this, arguments);
            json.code = this.get_giftcard_line_code();
            json.payment_charge = this.get_payment_charge();
            json.redeem = this.get_payment_redeem_giftcard();
            json.gift_redeem_amount = this.get_gift_redeem_amount();
            return json;
        },
        set_giftcard_line_code: function(code) {
            this.code = code;
            this.trigger('change', this);
        },
        set_payment_redeem_giftcard: function(redeem) {
            if (redeem && redeem != 'null' && redeem != undefined) {
                this.redeem.push(redeem);
            } else {
                this.redeem = [];
            }
            this.trigger('change', this);
        },
        get_payment_redeem_giftcard: function() {
            return this.redeem;
        },
        get_giftcard_line_code: function() {
            return this.code;
        },
        set_payment_charge: function(val) {
            this.payment_charge = val;
            this.trigger('change', this);
        },
        get_payment_charge: function(val) {
            return this.payment_charge;
        },
    });

    screens.PaymentScreenWidget.include({
        renderElement: function() {
            var self = this;
            self._super();
            var order = self.pos.get_order();
            this.$('.js_gift_card').click(function() {
                var client = order.get_client();
                if (!order.get_giftcard().length > 0) {
                    self.gui.show_popup('redeem_card_popup', {
                        'payment_self': self
                    });
                }
            });
        },
        click_numpad: function(button) {
            var paymentlines = this.pos.get_order().get_paymentlines();
            var open_paymentline = false;

            for (var i = 0; i < paymentlines.length; i++) {
                if (!paymentlines[i].paid) {
                    open_paymentline = true;
                }
            }

            if (!open_paymentline) {
                var default_journal = this.pos.cashregisters[0];
                _.each(this.pos.cashregisters, function(cashregister) {
                    if (cashregister.journal &&
                        cashregister.journal.pos_front_display &&
                        cashregister.journal.type == 'cash') {
                        default_journal = cashregister;
                    }
                });
                this.pos.get_order().add_paymentline(default_journal);
                this.render_paymentlines();
            }

            this.payment_input(button.data('action'));
        },
    });

    var RedeemCardPopupWidget = PopupWidget.extend({
        template: 'RedeemCardPopupWidget',

        show: function(options) {
            self = this;
            this.payment_self = options.payment_self || false;
            this._super();

            self.redeem = false;
            var order = self.pos.get_order();
            if (self.payment_self) {
                $('body').off('keypress', self.payment_self.keyboard_handler);
                $('body').off('keydown', self.payment_self.keyboard_keydown_handler);
            }
            this.renderElement();
            $("#text_redeem_amount").keypress(function(e) {
                if (e.which != 8 && e.which != 0 && (e.which < 48 || e.which > 57) && e.which != 46) {
                    return false;
                }
            });
            $('#text_gift_card_no').focus();
            $('#redeem_amount_row').hide();
            $('#in_balance').hide();
            $('#text_gift_card_no').keypress(function(e) {
                if (e.which == 13 && $(this).val()) {
                    var today = moment().format('YYYY-MM-DD');
                    var code = $(this).val();
                    var get_redeems = order.get_redeem_giftcard();
                    var existing_card = _.where(get_redeems, {
                        'redeem_card': code
                    });
                    rpc.query({
                        model: 'pos.gift.card',
                        method: 'search_read',
                        args: [
                            [
                                ['card_no', '=', code],
                                ['expire_date', '>=', today]
                            ]
                        ],
                    }).then(function(res) {
                        if (res.length > 0) {
                            if (res[0]) {
                                if (existing_card.length > 0) {
                                    var sum = _.reduce(_.pluck(existing_card, 'redeem_card_amount'), function(memo, num) {
                                        return parseFloat(memo) + parseFloat(num);
                                    }, 0);
                                    res[0]['card_value'] = res[0]['card_value'] - sum;
                                    res[0]['card_value'] = parseFloat(res[0]['card_value'].toFixed(2));
                                    //res[0]['card_value'] = existing_card[existing_card.length - 1]['redeem_remaining']
                                }
                                self.redeem = res[0];
                                $('#lbl_card_no').html("Amount: " + self.format_currency(res[0].card_value));
                                //   $('#lbl_set_customer').html("Customer: " + res[0].customer_id[1]);
                                if (res[0].card_value <= 0) {
                                    $('#redeem_amount_row').hide();
                                    $('#in_balance').show();
                                } else {
                                    $('#redeem_amount_row').fadeIn('fast');
                                    $('#text_redeem_amount').focus();
                                }
                            }
                        } else {
                            alert("Barcode not found Or Gift card has been expired.")
                            $('#text_gift_card_no').focus();
                            $('#lbl_card_no').html('');
                            //    $('#lbl_set_customer').html('');
                            $('#in_balance').html('');
                        }
                    });
                }
            });
        },

        click_cancel: function() {
            var self = this;
            self._super();
            if (self.payment_self) {
                $('body').keypress(self.payment_self.keyboard_handler);
                $('body').keydown(self.payment_self.keyboard_keydown_handler);
            }
        },

        click_confirm: function() {
            var order = self.pos.get_order();
            var client = order.get_client();
            var redeem_amount = this.$('#text_redeem_amount').val();
            var code = $('#text_gift_card_no').val();
            var due = order.get_due();
            if (self.redeem.card_no) {
                if (code == self.redeem.card_no) {
                    if (!self.redeem.card_value == 0) {
                        if (redeem_amount) {
                            if (redeem_amount <= due) {
                                if (!client) {
                                    //  order.set_client(self.pos.db.get_partner_by_id(self.redeem.customer_id[0]));
                                }
                                if (0 < Number(redeem_amount)) {
                                    if (self.redeem && self.redeem.card_value >= Number(redeem_amount)) {
                                        var vals = {
                                            'redeem_card_no': self.redeem.id,
                                            'redeem_card': $('#text_gift_card_no').val(),
                                            'redeem_card_amount': $('#text_redeem_amount').val(),
                                            'redeem_remaining': self.redeem.card_value - $('#text_redeem_amount').val(),
                                            'card_customer_id': self.redeem.customer_id[0] || false,
                                            'customer_name': self.redeem.customer_id[1],
                                        };
                                        var get_redeem = order.get_redeem_giftcard();
                                        if (get_redeem) {
                                            var product = self.pos.db.get_product_by_id(self.pos.config.enable_journal_id)
                                            var cashregisters = null;
                                            if (self.pos.config.enable_journal_id[0]) {
                                                for (var j = 0; j < self.pos.cashregisters.length; j++) {
                                                    if (self.pos.cashregisters[j].journal_id[0] === self.pos.config.enable_journal_id[0]) {
                                                        cashregisters = self.pos.cashregisters[j];
                                                    }
                                                }
                                            }
                                            if (vals) {
                                                if (self.payment_self) {
                                                    $('body').keypress(self.payment_self.keyboard_handler);
                                                    $('body').keydown(self.payment_self.keyboard_keydown_handler);
                                                }
                                                if (cashregisters) {
                                                    var paymentlines = order.get_paymentlines();
                                                    var card_paymentline = false;
                                                    var card_registers_paymentline = false;
                                                    for (var i = 0; i < paymentlines.length; i++) {
                                                        if (paymentlines[i].cashregister.journal_id[0] === self.pos.config.enable_journal_id[0]) {
                                                            card_paymentline = true;
                                                            card_registers_paymentline = paymentlines[i];
                                                            break;
                                                        }
                                                    }
                                                    if (!card_paymentline) {
                                                        order.add_paymentline(cashregisters);
                                                    } else if (card_paymentline) {
                                                        order.select_paymentline(card_registers_paymentline);
                                                        self.chrome.screens.payment.reset_input();
                                                        self.chrome.screens.payment.render_paymentlines();
                                                        redeem_amount = order.selected_paymentline.get_amount() + Math.max(redeem_amount);
                                                    }
                                                    order.selected_paymentline.set_amount(Math.max(redeem_amount), 0);
                                                    order.selected_paymentline.set_giftcard_line_code(code);
                                                    order.selected_paymentline.set_payment_redeem_giftcard(vals);
                                                    order.selected_paymentline.set_gift_redeem_amount(Math.max(redeem_amount), 0)
                                                    self.chrome.screens.payment.reset_input();
                                                    self.chrome.screens.payment.render_paymentlines();
                                                    order.set_redeem_giftcard(vals);
                                                    order.set_total_gift_card_redeem_amount(parseFloat($('#text_redeem_amount').val()));
                                                }
                                            }
                                            this.gui.close_popup();
                                        }
                                    } else {
                                        alert("Please enter amount below card value.");
                                        $('#text_redeem_amount').focus();
                                    }
                                } else {
                                    alert("Please enter valid amount.");
                                    $('#text_redeem_amount').focus();
                                }
                            } else {
                                alert("Card amount should be less than or equal to due amount");
                            }

                        } else {
                            alert("Please enter amount.");
                            $('#text_redeem_amount').focus();
                        }
                    }
                } else {
                    alert("Invalid barcode.");
                    $('#text_gift_card_no').focus();
                }
            } else {
                alert("Press Enter key.");
                $('#text_gift_card_no').focus();
            }
        },
    });
    gui.define_popup({
        name: 'redeem_card_popup',
        widget: RedeemCardPopupWidget
    });

    var PosGiftCardListButton = screens.ActionButtonWidget.extend({
        template: 'PosGiftCardListButton',
        button_click: function() {
            var self = this;
            self.gui.show_screen('giftcardlistscreen');
        }
    });

    screens.define_action_button({
        'name': 'pos_gift_card',
        'widget': PosGiftCardListButton,
        'condition': function() {
            return this.pos.config.enable_gift_card;
        },
    });

    var _super_posmodel = models.PosModel;
    models.PosModel = models.PosModel.extend({
        load_server_data: function() {
            var self = this;
            var loaded = _super_posmodel.prototype.load_server_data.call(this);
            var today = moment().format('YYYY-MM-DD');
            return loaded.then(function() {

                return rpc.query({
                    model: "pos.gift.card",
                    method: "search_read",
                    args: [
                        [
                            ['is_active', '=', true],
                            ['expire_date', '>=', today]
                        ]
                    ]
                }).then(function(gift_cards) {
                    self.db.add_giftcard(gift_cards);
                });
            });
        },
        load_new_gift_cards: function() {
            var self = this;
            var def = new $.Deferred();
            var fields = [];
            var card_write_date = this.db.get_card_write_date();
            var domain = [
                ['write_date', '>', card_write_date]
            ];
            if (!card_write_date) {
                domain = [];
            }
            rpc.query({
                    model: 'pos.gift.card',
                    method: 'search_read',
                    args: [domain, fields],
                }, {
                    shadow: true,
                })
                .then(function(gift_cards) {
                    if (self.db.add_giftcard(gift_cards)) { // check if the partners we got were real updates
                        def.resolve();
                    } else {
                        def.reject();
                    }
                }, function(err, event) {
                    event.preventDefault();
                    def.reject();
                });
            return def;
        },
    });

    DB.include({
        init: function(options) {
            this._super.apply(this, arguments);
            this.card_write_date = null;
            this.card_by_id = {};
            this.card_sorted = [];
        },
        search_gift_card: function(query) {
            var results = [];
            var self = this;
            var def = new $.Deferred();
            ajax.jsonRpc('/web/search_gift_card', 'call', {
                'query': query,
                'today': moment().format('YYYY-MM-DD'),
            }).done(function(cards) {
                var gift_card_data_list = [];
                _.map(cards, function(card) {
                    var gift_card = self.get_card_by_id(card);
                    gift_card_data_list.push(gift_card);
                })
                def.resolve(gift_card_data_list);
            });
            return def
        },
        add_giftcard: function(gift_cards) {
            var updated_count = 0;
            var new_write_date = '';
            for (var i = 0, len = gift_cards.length; i < len; i++) {
                var gift_card = gift_cards[i];
                if (this.card_write_date &&
                    this.card_by_id[gift_card.id] &&
                    new Date(this.card_write_date).getTime() + 1000 >=
                    new Date(gift_card.write_date).getTime()) {
                    continue;
                } else if (new_write_date < gift_card.write_date) {
                    new_write_date = gift_card.write_date;
                }
                if (!this.card_by_id[gift_card.id]) {
                    this.card_sorted.push(gift_card.id);
                }
                this.card_by_id[gift_card.id] = gift_card;
                updated_count += 1;
            }
            this.card_write_date = new_write_date || this.card_write_date;
            return updated_count;
        },
        get_card_write_date: function() {
            return this.card_write_date || "1970-01-01 00:00:00";
        },
        get_card_by_id: function(id) {
            return this.card_by_id[id];
        },
        get_cards_sorted: function(max_count) {
            max_count = max_count ? Math.min(this.card_sorted.length, max_count) : this.card_sorted.length;
            var gift_cards = [];
            for (var i = 0; i < max_count; i++) {
                gift_cards.push(this.card_by_id[this.card_sorted[i]]);
            }
            return gift_cards;
        },
    });

    var GiftCardListScreenWidget = screens.ScreenWidget.extend({
        template: 'GiftCardListScreenWidget',
        init: function(parent, options) {
            var self = this;
            this._super(parent, options);
        },
        show: function() {
            this._super();
            this.reload_gift_cards();
        },
        start: function() {
            var self = this;
            this._super();
            this.$('.back').click(function() {
                self.gui.back();
            });

            var gift_cards = this.pos.db.get_cards_sorted(1000);
            this.render_list(gift_cards);

            //Print card
            this.$('.giftcard-list-contents').delegate('#print_gift_card', 'click', function(event) {
                var card_id = parseInt($(this).data('id'));
                var result = self.pos.db.get_card_by_id(card_id);
                var gift_card_src = false;
                if (result) {
                    var barcode = result.card_no;
                    if (barcode) {
                        var barcode_val = barcode.toString();
                        var barcodeTemplate = QWeb.render('credit_voucherbarcode', {
                            widget: this,
                            barcode: barcode_val
                        });
                        $(barcodeTemplate).find('#barcode_credit_voucher').removeClass(barcode.toString());
                        $(barcodeTemplate).find('#barcode_credit_voucher').barcode(barcode_val.toString(), "code128");
                        if (_.isElement($(barcodeTemplate).find('#barcode_credit_voucher').barcode(barcode_val.toString(), "code128")[0])) {
                            if ($(barcodeTemplate).find('#barcode_credit_voucher').barcode(barcode_val.toString(), "code128")[0].firstChild != undefined &&
                                $(barcodeTemplate).find('#barcode_credit_voucher').barcode(barcode_val.toString(), "code128")[0].firstChild.data != undefined) {
                                gift_card_src = $(barcodeTemplate).find('#barcode_credit_voucher').barcode(barcode_val.toString(), "code128")[0].firstChild.data;
                            }
                        }
                        var receipt_type = false;
                        var receipt = false;
                        var expire_date_format = ""
                        if (result.expire_date) {
                            var expire_date = moment(result.expire_date, 'YYYY-MM-DD');
                            expire_date_format = moment(expire_date).format("DD/MM/YYYY");
                        }
                        if (!self.pos.config.iface_print_via_proxy) {
                            receipt = QWeb.render('PrintGiftCardPosTicket', {
                                widget: self,
                                gift_card: result,
                                gift_card_src: gift_card_src,
                                expire_date_format: expire_date_format,
                            });
                            receipt_type = 'normal';
                        } else {
                            receipt = QWeb.render('PrintGiftCardXmlReceipt', {
                                widget: self,
                                gift_card: result,
                                gift_card_src: gift_card_src,
                                expire_date_format: expire_date_format
                            });
                            receipt_type = 'xmlReceipt';
                        }
                        self.gui.show_screen('GiftCardReceipt', {
                            receipt: receipt,
                            receipt_type: receipt_type
                        });
                    }
                }
            });

            // Replacing searchbox code with a longer timeout
            var search_timeout = null;
            if (this.pos.config.iface_vkeyboard && self.chrome.widget.keyboard) {
                self.chrome.widget.keyboard.connect(this.$('.searchbox input'));
            }
            this.$('.searchbox input').off('keypress').on('keydown', function(event) {
                if (event.which === 13) {
                    clearTimeout(search_timeout);
                    var searchbox = this;
                    search_timeout = setTimeout(function() {
                        self.perform_search(searchbox.value, event.which === 13);
                    }, 70);
                }
            });
            this.$('.searchbox .search-clear').click(function() {
                self.clear_search();
            });
        },
        perform_search: function(query, associate_result) {
            var self = this;
            if (query) {
                self.pos.db.search_gift_card(query).done(function(gift_cards) {
                    self.render_list(gift_cards);
                })
            } else {
                var gift_cards = self.pos.db.get_cards_sorted();
                this.render_list(gift_cards);
            }
        },
        clear_search: function() {
            var gift_cards = this.pos.db.get_cards_sorted();
            this.render_list(gift_cards);
            this.$('.searchbox input')[0].value = '';
            this.$('.searchbox input').focus();
        },
        render_list: function(gift_cards) {
            var self = this;
            var contents = this.$el[0].querySelector('.giftcard-list-contents');
            contents.innerHTML = "";
            for (var i = 0, len = Math.min(gift_cards.length); i < len; i++) {
                var gift_card = gift_cards[i];
                var today = moment().format('YYYY-MM-DD');
                if (today > gift_card.expire_date) {
                    continue;
                }
                gift_card.amount = parseFloat(gift_card.amount).toFixed(2);

                var expire_date_format = "";
                if (gift_card.expire_date) {
                    var expire_date = moment(gift_card.expire_date, 'YYYY-MM-DD');
                    expire_date_format = moment(expire_date).format("DD/MM/YYYY");
                }
                var issue_date_format = "";
                if (gift_card.issue_date) {
                    var issue_date = moment(gift_card.issue_date, 'YYYY-MM-DD');
                    issue_date_format = moment(issue_date).format("DD/MM/YYYY");
                }

                var clientline_html = QWeb.render('GiftCardlistLine', {
                    widget: this,
                    gift_card: gift_card,
                    expire_date_format: expire_date_format,
                    issue_date_format: issue_date_format
                });
                var clientline = document.createElement('tbody');
                clientline.innerHTML = clientline_html;
                clientline = clientline.childNodes[1];
                contents.appendChild(clientline);
            }
        },
        reload_gift_cards: function() {
            var self = this;
            return this.pos.load_new_gift_cards().then(function() {
                self.render_list(self.pos.db.get_cards_sorted(1000));
            });
        },
        close: function() {
            this._super();
            this.$('.searchbox input')[0].value = '';
            if (this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard) {
                this.chrome.widget.keyboard.hide();
            }
        },
    });
    gui.define_screen({
        name: 'giftcardlistscreen',
        widget: GiftCardListScreenWidget
    });

    var GiftCardReceiptScreenWidget = screens.ScreenWidget.extend({
        template: 'GiftCardReceiptScreenWidget',
        show: function() {
            this._super();
            var self = this;
            this.render_receipt();
        },
        renderElement: function() {
            var self = this;
            this._super();
            this.$('.next').click(function() {
                self.click_next();
            });
            this.$('.button.print').click(function() {
                self.print();
            });
        },
        click_next: function() {
            this.gui.show_screen('products');
        },
        render_receipt: function() {
            var receipt_type = this.gui.get_current_screen_param('receipt_type');
            var receipt = this.gui.get_current_screen_param('receipt');
            if (receipt_type === 'xmlReceipt') {
                this.pos.proxy.print_receipt(receipt);
                this.click_next();
            } else {
                this.$('.pos-receipt-container').html(receipt);
            }
        },
        print: function() {
            var self = this;
            if (!this.pos.config.iface_print_via_proxy) {
                this.print_web();
            } else {
                this.print_xml();
            }
        },
        print_web: function() {
            if ($.browser.safari) {
                document.execCommand('print', false, null);
            } else {
                try {
                    window.print();
                } catch (err) {
                    if (navigator.userAgent.toLowerCase().indexOf("android") > -1) {
                        this.gui.show_popup('error', {
                            'title': _t('Printing is not supported on some android browsers'),
                            'body': _t('Printing is not supported on some android browsers due to no default printing protocol is available. It is possible to print your tickets by making use of an IoT Box.'),
                        });
                    } else {
                        throw err;
                    }
                }
            }
        },
    });
    gui.define_screen({
        name: 'GiftCardReceipt',
        widget: GiftCardReceiptScreenWidget
    });

});