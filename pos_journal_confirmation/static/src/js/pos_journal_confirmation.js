odoo.define('pos_journal_confirmation.pos_journal_confirmation', function (require) {
    "use strict";

    var core = require('web.core');
    var models = require('point_of_sale.models');
    var screens = require("point_of_sale.screens");

    var _t = core._t;

    models.load_fields('account.journal', ['group_code']);

    models.PosModel.prototype.models.push({
        model: 'account.journal.group',
        fields: [],
        loaded: function(self, journal_groups){
            self.account_journal_group = {};
            _.each(journal_groups,function(journal_group){
                self.account_journal_group[journal_group.id] = journal_group;
            });
        },
    });

    screens.PaymentScreenWidget.include({
        click_paymentmethods: function(id) {
            var cashregister = null;
            var self = this;
            for ( var i = 0; i < this.pos.cashregisters.length; i++ ) {
                if ( this.pos.cashregisters[i].journal_id[0] === id ){
                    cashregister = this.pos.cashregisters[i];
                    break;
                }
            }
            var account_journal_group = self.pos.account_journal_group;
            var journal = cashregister.journal;
            if(journal.group_code && journal.group_code[0]
                    && account_journal_group 
                    && account_journal_group[journal.group_code[0]]
                    && account_journal_group[journal.group_code[0]].confirmation_message){
                var msg = account_journal_group[journal.group_code[0]].confirmation_message;
                self.gui.show_popup('confirm', {
                    title: _t('Warning !!'),
                    body: _t(msg),
                    confirm: function() {
                        self.pos.get_order().add_paymentline( cashregister );
                        self.reset_input();
                        self.render_paymentlines();
                    },
                });
            }else{
                this.pos.get_order().add_paymentline( cashregister );
                this.reset_input();
                this.render_paymentlines();
            }
        },
    });

});