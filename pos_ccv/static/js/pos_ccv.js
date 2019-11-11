// send request
// curl "http://192.168.5.191:5000/start_tx?callback=logResults&amount=0.01&currency=EUR&terminal_number=1&receipt_number=0&product_info=4&_=1542125251861"
// request update
// curl http://192.168.5.191:5000/check_tx/{{TRANSACTION_ID}}

odoo.define('pos_ccv.pos', function (require) {

    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var utils = require('web.utils');
    var gui = require('point_of_sale.gui');
    var PopupWidget = require('point_of_sale.popups');
    var _t = core._t;
    var field_utils = require('web.field_utils');

    models.load_fields(
        "account.journal",
        ['is_ccv_interim_journal', 'is_ccv_journal', 'ccv_terminal_code']
    );

    var tx_result_codes = {
        '-4': "Communication failure during TX: CHECK PAYMENT OK/NOK",
        '-3': "Communication failure: RETRY PAYMENT",
        '-2': "Transaction is running, check again",
        '-1': "Transaction not found",
        '0': "OK",
        '1': "Not OK",
        '2': "Valuta wrong",
        '3': "Productinfo wrong",
        '4': "Price/litre rate check failed",
        '5': "Total amount not equal to sum subtotals",
        '6': "Syntax Error, transaction failed",
        '7': "Amount not allowed (zero transaction)",
        '8': "Amount too high (> 99999,99)",
        '9': "Invalid Message Version Number",
        'A': "Trx still busy with (loyalty) transaction.",
    }

    var issuer_result_codes = {
        '00': "no cardswipe (default)",
        '  ': "Bancontact/Mistercash",
        'EC': "MasterCard",
        'VI': "Visa / Visa Electron",
        'MX': "American Express",
        'DC': "Diners Club",
        'JC': "JCB card",
        'CC': "Comfort Card",
        'MA': "Maestro",
        'AU': "Aurora",
        'SE': "Sodexo e-Pass",
        'ER': "Edenred",
        'PF': "Payfair",
        'KD': "Kadoz",
        'RS': "RES",
        'CB': "Carte Bancaire",
        'VP': "V Pay",
        'BW': "Buy Way",
    }

    var CCVPaymentPopupWidget = PopupWidget.extend({
        template: 'CCVPaymentPopup',
        show: function (options) {
            options = options || {};
            var self = this;
            self.picking_types = options.stock_pick_types || [];
            self.location = options.location || [];
            self._super(options);
            self.address = self.pos.config.ccv_endpoint_address;

            console.info('ccv version 12.0.0.1')

            if ('data' in options) {
                self.lines = options['data'];
            }

            if ('PaymentScreenWidget' in options) {
                self.PaymentScreenWidget = options['PaymentScreenWidget']
            }

            if ('nextAction' in options) {
                self.nextAction = options['nextAction'];
            }

            self.renderElement();

            // caching
            self.buttonConfirm = $('.confirm-payments');
            self.buttonCancel = $('.cancel-payments');
            self.transactionElements = {};
            var btns = $('.btn-payment');
            _.each(btns, function(button) {
                var id = $(button).attr("data-id");
                var paymentType = $(".spn-payment-type[data-id='" + id + "']");
                var errorRow = $(".error-row[data-id='" + id + "']");
                self.transactionElements[id] = {
                    button: $(button),
                    paymentType: paymentType,
                    errorRow: errorRow,
                    error: errorRow.find('.error-message')
                }
                $(button).keypress(function(event){
                    event.preventDefault();
                });
                $(button).keydown(function(event){
                    event.preventDefault();
                });
                $(button).keyup(function(event){
                    event.preventDefault();
                });
            });

            self.buttonConfirm.hide();
            $('.error-row').hide();

            btns.click(function (e) {
                self.start_transaction($(this), false);
            });

            if (btns.length === 1) {
                self.start_transaction(btns, false);
            }
        },
        txFail: function(buttonId, buttonMessage, errorMessage) {
            var self = this;
            var obj = self.transactionElements[buttonId];
            if (obj.button.hasClass("btn-busy")) {
                obj.button.removeClass("btn-busy");
            }
            obj.button.addClass('btn-error');
            self.txResetGlobalTimeout(buttonId);

            // self.buttonCancel.show();
            self.buttonConfirm.show();

            obj.button.unbind("click");
            obj.button.click(function (e) {
                self.start_transaction($(this), false);
            });

            obj.button.text(buttonMessage);
            if (errorMessage) {
                obj.error.text(errorMessage);
                obj.errorRow.show();
            } else {
                obj.error.text('');
                obj.errorRow.hide();
            }
        },
        txBusy: function(buttonId, buttonMessage, errorMessage) {
            var self = this;
            var obj = self.transactionElements[buttonId];

            if (obj.button.hasClass("btn-error")) {
                obj.button.removeClass("btn-error");
            }
            obj.button.addClass('btn-busy');
            // make sure you can't click while alive
            obj.button.unbind("click");
            self.buttonCancel.hide();

            if (!obj.alive) {
                obj.alive = '  .';
            }

            self.buttonCancel.hide();
            self.buttonConfirm.hide();

            switch (obj.alive) {
                case '  .':
                    obj.alive = '.  ';
                    break;
                case '.  ':
                    obj.alive = ' . ';
                    break;
                case ' . ':
                    obj.alive = '  .';
                    break;
            }
            obj.button.html(buttonMessage + ' ' + obj.alive);

            if (errorMessage) {
                obj.error.text(errorMessage);
                obj.errorRow.show();
            } else {
                obj.error.text('');
                obj.errorRow.hide();
            }
        },
        txInfo: function(buttonId, buttonMessage) {
            var self = this;
            var obj = self.transactionElements[buttonId];
            // make sure you can't click while alive
            obj.button.unbind("click");
            if (obj.button.hasClass("btn-error")) {
                obj.button.removeClass("btn-error");
            }
            if (obj.button.hasClass("btn-busy")) {
                obj.button.removeClass("btn-busy");
            }
            obj.button.text(buttonMessage);
            obj.errorRow.hide();
            obj.error.text('');
            self.buttonCancel.hide();
        },
        txSucceed: function(buttonId, buttonMessage, paymentType) {
            var self = this;
            self.txResetGlobalTimeout(buttonId);
            var obj = self.transactionElements[buttonId];
            if (obj.button.hasClass("btn-error")) {
                obj.button.removeClass("btn-error");
            }
            obj.errorRow.hide();
            obj.error.text('');

            obj.button.text(buttonMessage);
            obj.button.addClass('btn-paid');
            obj.button.unbind("click");
            obj.button.removeClass('btn-payment');

            obj.paymentType.html(paymentType)

            self.buttonConfirm.show();
        },
        txTimeout: function(buttonId, fnc, timeout) {
            var self = this;
            var obj = self.transactionElements[buttonId];
            if (obj.timeout) {
                // don't add a timeout if a timeout is running
                console.log("Second timeout ignored on button " + buttonId)
                return;
            }
            obj.timeout = setTimeout(function(){
                clearTimeout(obj.timeout)
                obj.timeout = null
                fnc()
            }, timeout);
        },
        txResetTimeout: function(buttonId) {
            var self = this;
            var obj = self.transactionElements[buttonId];
            if (obj.timeout) {
                clearTimeout(obj.timeout);
                obj.timeout = null;
            }
        },
        txSetGlobalTimeout: function(buttonId) {
            var self = this;
            var obj = self.transactionElements[buttonId];
            if (obj.globalTimeout) {
                // don't set an extra global timeout
                return;
            }
            obj.globalTimeout = setTimeout(function() {
                console.info('Global transaction timeout reached after 180 seconds')
                self.txResetTimeout(buttonId)
                clearTimeout(obj.globalTimeout)
                obj.globalTimeout = null
                self.paymentSucceededConfirmation(buttonId);
            }, 180000)
        },
        txResetGlobalTimeout: function(buttonId) {
            var self = this;
            var obj = self.transactionElements[buttonId];
            if (obj.globalTimeout) {
                clearTimeout(obj.globalTimeout);
                obj.globalTimeout = null;
            }
        },
        txResetAllTimeouts: function() {
            for (var property in self.transactionElements) {
                if (self.transactionElements.hasOwnProperty(property)) {
                    if (property.timeout) {
                        clearTimeout(property.timeout);
                        property.timeout = null;
                    }
                    if (property.globalTimeout) {
                        clearTimeout(property.globalTimeout);
                        property.globalTimeout = null;
                    }
                }
            }
        },
        getAmountStr: function(amount){
            return field_utils.format.float(amount, {digits: [69, this.pos.currency.decimals]});
        },
        hasCCVPayments: function() {
            var self = this;
            var order = self.pos.get_order();
            var paymentlines = order.get_paymentlines();
            for (var i = 0; i < paymentlines.length; i++) {
                if (paymentlines[i].cashregister.journal.is_ccv_interim_journal) {
                    return true;
                }
            }
            return false;
        },
        start_transaction: function(button, isRetry) {
            var self = this;
            var id = button.attr("data-id");
            var amount = 0;
            var currency = "EUR";
            var terminal_number = 1;
            var receipt_number = 0;
            var product_info = 'payment';
            _.each(self.lines, function (paymentline) {
                if (id === paymentline.id) {
                    amount = paymentline.amount;
                    product_info = paymentline.order.name.match(/\d+/g).map(Number)[0];
                }
            });

            if (!isRetry) {
                self.txInfo(id, 'Sending')
            }

            self.txSetGlobalTimeout(id)

            var data = {
                "amount": amount,
                "currency": currency,
                "terminal_number": terminal_number,
                "receipt_number": receipt_number,
                "product_info": product_info
            }

            console.info('Starting transaction')
            console.info(data)

            $.ajax({
                url: self.address + '/start_tx',
                method: "GET",
                timeout: 2000,
                data: data,
                cache: false,
                dataType: "jsonp",
                crossDomain: true,
                headers: {
                    'Access-Control-Allow-Origin': '*'
                },
                success: function (data) {
                    if ('err' in data) {
                        if (data['err'] === 'Terminal is busy') {
                            self.txBusy(id, 'Busy', 'Terminal is busy, automatically retrying');
                            self.txTimeout(id ,function() {
                                self.start_transaction(button, true);
                            }, 1000)
                        } else {
                            self.txFail(id, 'Retry', 'Undefined exception: ' + data['err']);
                        }
                    } else {
                        self.txTimeout(id, function() {
                                self.poll_transaction(button, data);
                        }, 100);
                        self.tx_id = data.tx_id;
                    }
                },
                error: function (xmlhttprequest, textstatus, message) {
                    console.log(textstatus);
                    self.txFail(id, 'Retry', 'An error ocurred while connecting to the payment terminal');
                }
            });
        },
        poll_transaction: function (button, tx_data) {
            var self = this;
            var id = button.attr("data-id");
            $.ajax({
                url: self.address + '/check_tx/' + tx_data.tx_id,
                method: "GET",
                timeout: 2000,
                cache: false,
                dataType: "jsonp",
                crossDomain: true,
                success: function (data) {
                    if ('err' in data) {
                        if (data.err === 'TX not found') {
                            self.txFail(id, 'Retry', 'Communication Error');
                        } else {
                            console.log(data.err);
                            self.txFail(id, 'Retry', 'Undefined exception: ' + data['err']);
                        }
                        return
                    }
                    switch (data.tx_result_code) {
                        case '-4':
                            self.tx_result_code = data.tx_result_code;
                            console.log(data.tx_result_info);
                            self.txFail(id, 'Manual', false);
                            button.unbind("click");
                            self.paymentSucceededConfirmation(id);
                            break;
                        case '-3':
                            self.tx_result_code = data.tx_result_code;
                            console.log(data.tx_result_info);
                            self.txBusy(id, 'Retrying', 'Communication failure, automatically retrying');
                            self.txTimeout(id, function() {
                                self.start_transaction(button, true);
                            }, 1000);
                            break;
                        case '-2':
                            self.tx_result_code = data.tx_result_code;
                            console.log(data.tx_result_info);
                            self.txBusy(id, 'Waiting');
                            self.txTimeout(id, function() {
                                self.poll_transaction(button, tx_data);
                            }, 100);
                            break;
                        case '-1':
                            self.tx_result_code = data.tx_result_code;
                            console.log(data.tx_result_info);
                            self.txFail(id, 'Retry', 'Communication Error');
                            break;
                        case '0':
                            self.tx_result_code = data.tx_result_code;
                            console.log(data.tx_result_info);
                            self.handlePayment(id, data)
                            break;
                        case '1':
                            self.tx_result_code = data.tx_result_code;
                            console.log(data.tx_result_info);
                            self.txFail(id, 'Retry', 'Cancelled on terminal');
                            break;
                        case '2':
                        case '3':
                        case '4':
                        case '5':
                        case '6':
                        case '7':
                        case '8':
                        case '9':
                            self.tx_result_code = data.tx_result_code;
                            console.log(data.tx_result_info);
                            self.txFail(id, 'Retry', data.tx_result_info);
                            break;
                        case 'A':
                            self.tx_result_code = data.tx_result_code;
                            console.log(data.tx_result_info);
                            self.txBusy(id, 'Retry', 'Terminal Busy, automatically retrying');
                            self.txTimeout(id, function() {
                                self.start_transaction(button, true);
                            }, 1000);
                            break;
                    }
                },
                error: function (xmlhttprequest, textstatus, message) {
                    self.txFail(id, 'Retry', 'An error ocurred while connecting to the payment terminal');
                    console.log(textstatus);
                    if (self.tx_result_code === '-2') {
                        self.txFail(id, 'Manual');
                        self.paymentSucceededConfirmation(id);
                    }
                }
            });
        },
        paymentSucceededConfirmation: function (id) {
            var self = this;
            var cashregisters = self.pos.cashregisters;

            self.txFail(id, 'paid?', 'Did the transaction succeed?')

            var select = "<select name='trans_action_state' class='trans_action_state' data-id=" + id + ">";
            select += "<option disabled selected value> -- select an option -- </option>";
            select += "<option value='failed'>Failed</option>";
            _.each(cashregisters, function (cashregister) {
                if (cashregister.journal && cashregister.journal.is_ccv_journal) {
                    select += "<option value='" + cashregister.journal.ccv_terminal_code + "'>" + cashregister.journal_id[1] + "</option>";
                }
            });

            select += "</select>";

            var obj = self.transactionElements[id];
            // txFail sets a retry action
            obj.button.unbind("click");
            obj.paymentType.html(select);

            console.info('Manual confirmation needed')

            self.buttonCancel.hide();
            self.buttonConfirm.hide();

            $('.trans_action_state').change(function (e) {
                var select_val = $(e.target).val();
                if (select_val !== 'failed') {
                    obj.button.html('save paid')
                    obj.button.unbind("click");
                    obj.button.click(function (e) {
                        var myselect = $(".trans_action_state[data-id='" + id + "']")
                        var select_val = myselect.val();
                        if (select_val !== 'failed') {
                            for (var i = 0; i < self.lines.length; i++) {
                                if (self.lines[i].id === id) {
                                    var data = {
                                        "issuer_result_code": select_val,
                                        "issuer_result_info": issuer_result_codes[select_val],
                                        "response_amount": self.lines[i].amount,
                                    }
                                    console.info('Manual confirmation method selected')
                                    console.info(data)
                                    self.handlePayment(id, data)
                                    break;
                                }
                            }
                        } else {
                            console.info('Option \'Failed\' button click...')
                        }
                    });
                    self.buttonCancel.hide();
                    self.buttonConfirm.hide();
                } else {
                    console.info('Option \'Failed\' selected')
                    obj.button.html('fail paid')
                    obj.button.unbind("click");
                    // self.buttonCancel.show();
                    self.buttonConfirm.show();
                }
            });
        },
        handlePayment: function (id, data) {
            var self = this;
            var order = self.pos.get_order();
            var paymentlines = order.get_paymentlines();
            var cashregisters = self.pos.cashregisters;

            var paymentlines = paymentlines.filter(function(paymentline){
                return paymentline.cashregister.journal.is_ccv_interim_journal && paymentline.cid === id;
            })

            if (paymentlines.length !== 1) {
                if (paymentlines.length > 1) {
                    console.log('multiple lines with same payment ID')
                } else {
                    console.log('no lines with payment ID')
                }
            }

            var paymentline = paymentlines[0];
            var cashregister = null;
            for (var i = 0; i < cashregisters.length; i++) {
                if (cashregisters[i].journal &&
                    cashregisters[i].journal.is_ccv_journal &&
                    cashregisters[i].journal.ccv_terminal_code == data.issuer_result_code) {
                    cashregister = cashregisters[i]
                    break
                }
            }

            if (!cashregister) {
                self.paymentSucceededConfirmation(id)
                return
            }

            console.info('Registering new payment')

            var newPaymentline = new models.Paymentline({}, {
                order: order,
                cashregister: cashregister,
                pos: order.pos
            });
            // rounding done in set_amount
            newPaymentline.set_amount(parseFloat(data.response_amount));

            self.pos.get_order().paymentlines.add(newPaymentline);
            self.pos.get_order().paymentlines.remove(paymentline);
            self.txSucceed(id, 'Paid', data.issuer_result_info);
            console.info('Payment registration succeeded')

        },
        click_confirm: function () {
            var self = this;
            self.txResetAllTimeouts()

            console.info('Closing pop-up')
            self.pos.gui.close_popup('ccv_payment_popup');
            self.PaymentScreenWidget.reset_input()
            console.log('Re-rendering payment lines')
            self.PaymentScreenWidget.render_paymentlines()

            console.info('Checking if we have a next action and no CCV payments left')
            self.PaymentScreenWidget.prevent_events = false
            if (!self.hasCCVPayments() && self.nextAction) {
                console.info('Executing next action')
                self.nextAction.call(self.PaymentScreenWidget)
            }
        },
        click_cancel: function() {
            var self = this;
            self.txResetAllTimeouts()
            self.pos.gui.close_popup('ccv_payment_popup');
            self.PaymentScreenWidget.prevent_events = false
            console.info('Closing pop-up (cancel operation)')
        }
    });

    gui.define_popup({name: 'ccv_payment_popup', widget: CCVPaymentPopupWidget});


    screens.PaymentScreenWidget.include({
        prevent_events: false,
        init: function(parent, options) {
            var self = this;
            this._super(parent, options);

            this.original_keyboard_handler = this.keyboard_handler
            this.keyboard_handler = function(event) {
                if (self.prevent_events) {
                    return;
                }
                self.original_keyboard_handler(event);
            }
        },
        validate_order: function (force_validation) {
            var self = this;
            if (this.order_is_valid(force_validation)) {
                var order = self.pos.get_order();
                var paymentlines = order.get_paymentlines();
                if (paymentlines.length) {
                    var terminal_lines = [];
                    var has_terminal_lines = false;
                    for (var i = 0; i < paymentlines.length; i++) {
                        if (paymentlines[i].cashregister.journal.is_ccv_interim_journal) {
                            has_terminal_lines = true;
                            terminal_lines.push({
                                id: paymentlines[i].cid,
                                journal_id: paymentlines[i].cashregister.journal,
                                name: paymentlines[i].cashregister.journal_id[1],
                                amount: paymentlines[i].get_amount(),
                                order: order
                            });
                        }
                    }
                    if (has_terminal_lines) {
                        console.info('CCV terminal payments present')
                        self.prevent_events = true
                        self.gui.show_popup('ccv_payment_popup', {
                            'data': terminal_lines,
                            'PaymentScreenWidget': self,
                            'nextAction': function() {
                                self.prevent_events = false
                                self.validate_order(force_validation)
                            }
                        });
                    } else {
                        console.info('No unpaid CCV terminal lines found, taking normal route')
                        return this._super(force_validation);
                    }
                }
            }
        },
        render_paymentmethods: function() {
            var methods = this._super();

            var self  = this;
            var order = this.pos.get_order();
            var cashregisters = self.pos.cashregisters;

            for (var i = 0; i < cashregisters.length; i++) {
                var cashregister = cashregisters[i];

                if (cashregister.journal && cashregister.journal.is_ccv_journal) {
                    methods.find(".paymentmethod[data-id='" + cashregister.journal_id[0] + "']").hide().unbind("click");
                }
            }

            return methods
        },
        render_paymentlines: function() {
            var self  = this;

            this._super();

            var order = this.pos.get_order();
            if (!order) {
                return;
            }
            var lines = order.get_paymentlines();

            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                if (line.cashregister.journal && line.cashregister.journal.is_ccv_journal) {
                    $(".delete-button[data-cid='" + line.cid + "']").unbind("click").replaceWith( "<td></td>" );
                }
            }
        },
        payment_input: function(input) {
            var self = this;

            var order = this.pos.get_order();
            if (order.selected_paymentline) {
                var line = order.selected_paymentline
                if (line.cashregister.journal && line.cashregister.journal.is_ccv_journal) {
                    return;
                }
            }

            this._super(input);
        },
        reservation_partial_payment: function() {
            var self = this;
            var order = self.pos.get_order();
            var paymentlines = order.get_paymentlines();
            if (paymentlines.length) {
                var terminal_lines = [];
                var has_terminal_lines = false;
                for (var i = 0; i < paymentlines.length; i++) {
                    if (paymentlines[i].cashregister.journal.is_ccv_interim_journal) {
                        has_terminal_lines = true;
                        terminal_lines.push({
                            id: paymentlines[i].cid,
                            journal_id: paymentlines[i].cashregister.journal,
                            name: paymentlines[i].cashregister.journal_id[1],
                            amount: paymentlines[i].get_amount(),
                            order: order
                        });
                    }
                }
                if (has_terminal_lines) {
                    console.info('CCV terminal payments present')
                    self.prevent_events = true
                    self.gui.show_popup('ccv_payment_popup', {
                        'data': terminal_lines,
                        'PaymentScreenWidget': self,
                        'nextAction': function() {
                            self.prevent_events = false
                            self.reservation_partial_payment()
                        }
                    });
                } else {
                    return this._super();
                }
            }
        },
    });
});
