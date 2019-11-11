odoo.define('pos_client_list.pos_client_list', function(require) {
    "use strict"

    var ajax = require('web.ajax');
    var core = require('web.core');
    var DB = require('point_of_sale.DB');
    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');
    var session = require('web.session');

    var is_pos_discount_management_install = _.contains(session.module_list, 'pos_discount_management');
    var is_pos_loyalty_amount_install = _.contains(session.module_list, 'pos_loyalty_amount');
    var is_pos_quick_load_data_install = _.contains(session.module_list, 'pos_quick_load_data');

    var QWeb = core.qweb

    models.load_fields("res.partner", ['ref']);

    function load_sort_order(model_name, sort_order) {
        if (!(sort_order instanceof Array)) {
            sort_order = [sort_order];
        }
        var omodels = models.PosModel.prototype.models;
        for (var i = 0; i < omodels.length; i++) {
            var model = omodels[i];
            if (model.model === model_name) {
                if (model.order && (model.order instanceof Array) && model.order.length > 0) {
                    model.order = model.order.concat(sort_order || []);
                } else {
                    model.order = [sort_order];
                }
            }
        }
    }
    load_sort_order('res.partner', ['name']);

    screens.ClientListScreenWidget.include({
        show: function() {
            this._super();
            var self = this;
            // Replacing searchbox code with a longer timeout
            var search_timeout = null;
            this.$('.searchbox input').off('keypress').on('keydown', function(event) {
                if (event.which === 13) {
                    clearTimeout(search_timeout);
                    var searchbox = this;
                    search_timeout = setTimeout(function() {
                        self.perform_search(searchbox.value, event.which === 13);
                    }, 70);
                }
            });
            this.$('.searchbox .search-clear').off('click').on('click', function(event) {
                var searchbox = $(this).parent().find('input')
                search_timeout = setTimeout(function() {
                    self.perform_search(searchbox.val(), true);
                }, 70);
            });
        },
        perform_search: function(query, associate_result) {
            var customers;
            var self = this;
            if (query) {
                this.pos.db.search_partner(query).done(function(partners) {
                    customers = partners;
                    self.display_client_details('hide');
                    self.render_list(customers);
                });
            } else {
                customers = this.pos.db.get_partners_sorted();
                this.render_list(customers);
            }
        },
        render_list: function(partners) {
            var contents = this.$el[0].querySelector('.client-list-contents');
            contents.innerHTML = "";
            //for (var i = 0, len = Math.min(partners.length, 100); i < len; i++) {
            for (var i = 0, len = partners.length; i < len; i++) {
                var partner = partners[i];
                var clientline = this.partner_cache.get_node(partner.id);
                if (!clientline) {
                    var clientline_html = QWeb.render('ClientLine', {
                        widget: this,
                        partner: partners[i]
                    });
                    var clientline = document.createElement('tbody');
                    clientline.innerHTML = clientline_html;
                    clientline = clientline.childNodes[1];
                    this.partner_cache.cache_node(partner.id, clientline);
                }
                if (partner === this.old_client) {
                    clientline.classList.add('highlight');
                } else {
                    clientline.classList.remove('highlight');
                }
                contents.appendChild(clientline);
            }
        },
    });

    DB.include({
        //        init: function(options){
        //            this.partner_ref_search_string = "";
        //            this._super(options);
        //        },
        //        add_partners: function(partners){
        //            var updated_count = 0;
        //            var new_write_date = '';
        //            var partner;
        //            for(var i = 0, len = partners.length; i < len; i++){
        //                partner = partners[i];
        //
        //                var local_partner_date = (this.partner_write_date || '').replace(/^(\d{4}-\d{2}-\d{2}) ((\d{2}:?){3})$/, '$1T$2Z');
        //                var dist_partner_date = (partner.write_date || '').replace(/^(\d{4}-\d{2}-\d{2}) ((\d{2}:?){3})$/, '$1T$2Z');
        //                if (    this.partner_write_date &&
        //                        this.partner_by_id[partner.id] &&
        //                        new Date(local_partner_date).getTime() + 1000 >=
        //                        new Date(dist_partner_date).getTime() ) {
        //                    // FIXME: The write_date is stored with milisec precision in the database
        //                    // but the dates we get back are only precise to the second. This means when
        //                    // you read partners modified strictly after time X, you get back partners that were
        //                    // modified X - 1 sec ago. 
        //                    continue;
        //                } else if ( new_write_date < partner.write_date ) { 
        //                    new_write_date  = partner.write_date;
        //                }
        //                if (!this.partner_by_id[partner.id]) {
        //                    this.partner_sorted.push(partner.id);
        //                }
        //                this.partner_by_id[partner.id] = partner;
        //
        //                updated_count += 1;
        //            }
        //
        //            this.partner_write_date = new_write_date || this.partner_write_date;
        //
        //            if (updated_count) {
        //                // If there were updates, we need to completely 
        //                // rebuild the search string and the barcode indexing
        //
        //                this.partner_search_string = "";
        //                this.partner_by_barcode = {};
        //
        //                for (var i = 0; i < this.partner_sorted.length; i++) {
        //                    partner = this.partner_by_id[this.partner_sorted[i]];
        //
        //                    if(partner.barcode){
        //                        this.partner_by_barcode[partner.barcode] = partner;
        //                    }
        //                    partner.address = (partner.street || '') +', '+ 
        //                                      (partner.zip || '')    +' '+
        //                                      (partner.city || '')   +', '+ 
        //                                      (partner.country_id[1] || '');
        //                    this.partner_search_string += this._partner_search_string(partner);
        //                    this.partner_ref_search_string += this._partner_ref_search_string(partner);
        //                }
        //            }
        //            return updated_count;
        //        },
        get_partners_sorted: function(max_count) {
            max_count = Math.min(this.partner_sorted.length, 100) //max_count ? Math.min(this.partner_sorted.length, max_count) : this.partner_sorted.length;
            var partners = [];
            for (var i = 0; i < max_count; i++) {
                partners.push(this.partner_by_id[this.partner_sorted[i]]);
            }
            return partners;
        },
        search_partner: function(customer_query) {
            var results = [];
            var self = this;
            var ref_customer_query = customer_query;
            var def = new $.Deferred();
            ajax.jsonRpc('/web/search_partners', 'call', {
                'pos_fixed_discount': is_pos_discount_management_install,
                'is_pos_loyalty_amount_install': is_pos_loyalty_amount_install,
                'is_pos_quick_load_data_install': is_pos_quick_load_data_install,
                'query': customer_query,
            }).done(function(partners) {
                var partner_data_list = [];
                _.map(partners, function(lpartner) {
                    var partner = self.get_partner_by_id(lpartner);
                    partner_data_list.push(partner);
                })
                def.resolve(partner_data_list);
            });
            return def
        },
    });

});