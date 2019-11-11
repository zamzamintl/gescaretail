odoo.define('pos_negative_payment.negative_payment', function(require) {
    "use strict"

    var core = require('web.core');
    var field_utils = require('web.field_utils');
    var gui = require('point_of_sale.gui');

    var _t = core._t;

    gui.Gui.include({
        numpad_input: function(buffer, input, options) {
            var newbuf = buffer.slice(0);
            options = options || {};
            if (newbuf != '-') {
                var newbuf_float = field_utils.parse.float(newbuf);
            }
            var decimal_point = _t.database.parameters.decimal_point;
            if (input === decimal_point) {
                if (options.firstinput) {
                    newbuf = "0.";
                } else if (!newbuf.length || newbuf === '-') {
                    newbuf += "0.";
                } else if (newbuf.indexOf(decimal_point) < 0) {
                    newbuf = newbuf + decimal_point;
                }
            } else if (input === 'CLEAR') {
                newbuf = "";
            } else if (input === 'BACKSPACE') {
                newbuf = newbuf.substring(0, newbuf.length - 1);
            } else if (input === '+') {
                if (newbuf[0] === '-') {
                    newbuf = newbuf.substring(1, newbuf.length);
                }
            } else if (input === '-') {
                if (newbuf[0] === '-') {
                    newbuf = newbuf.substring(1, newbuf.length);
                } else {
                    if (newbuf === '0.00') {
                        newbuf = '-';
                    } else {
                        newbuf = '-' + newbuf;
                    }
                }
            } else if (input[0] === '+' && !isNaN(parseFloat(input) && newbuf != '-')) {
                newbuf = this.chrome.format_currency_no_symbol(newbuf_float + parseFloat(input));
            } else if (!isNaN(parseInt(input))) {
                if (options.firstinput) {
                    newbuf = '' + input;
                } else {
                    newbuf += input;
                }
            }
            // End of input buffer at 12 characters.
            if (newbuf.length > buffer.length && newbuf.length > 12) {
                this.play_sound('bell');
                return buffer.slice(0);
            }
            return newbuf;
        },
    });

});