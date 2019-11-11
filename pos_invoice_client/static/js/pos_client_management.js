odoo.define('pos_invoice_client.pos_client_management', function(require) {
    "use strict";

    var core = require('web.core');
    var gui = require('point_of_sale.gui');
    var models = require('point_of_sale.models');
    var PosDB = require('point_of_sale.DB');
    var rpc = require('web.rpc');
    var screens = require('point_of_sale.screens');

    var QWeb = core.qweb;
    var _t = core._t;

    models.load_fields("res.partner", ['pos_invoice_partner','parent_id', 'type']);

    screens.ClientListScreenWidget.include({
        save_client_details: function(partner) {
            var self = this;
            var fields_partner = {};
            this.$('.client-details-contents .detail').each(function(idx, el) {
                fields_partner[el.name] = el.value || false;
            });
            if (!fields_partner.name) {
                this.gui.show_popup('error', _t('Een Klant naam is vereist'));
                return;
            }
            if (this.uploaded_picture) {
                fields_partner.image = this.uploaded_picture;
            }
            fields_partner.id = partner.id || false;
            fields_partner.country_id = fields_partner.country_id || false;
            if (fields_partner.property_product_pricelist) {
                fields_partner.property_product_pricelist = parseInt(fields_partner.property_product_pricelist, 10);
            } else {
                fields_partner.property_product_pricelist = false;
            }
            var invoice_fields = {};
            var has_invoice_fields = false;
            this.$('.client-details-contents .invoice_detail').each(function(idx, el) {
                invoice_fields[el.name] = el.value || false;
                if (el.value != '') {
                    has_invoice_fields = true;
                }
            });
            if (!invoice_fields.name && has_invoice_fields == true) {
                this.gui.show_popup('error', _t('Een naam is verplicht voor een factuuradres'));
                return;
            }
            //invoice_fields.id = false;
            invoice_fields.country_id = invoice_fields.country_id || false;
            invoice_fields.type = 'invoice';
            if (!invoice_fields.parent_id) {
                invoice_fields.parent_id = partner.id || false;
            }
            if (invoice_fields.property_product_pricelist) {
                invoice_fields.property_product_pricelist = parseInt(invoice_fields.property_product_pricelist, 10);
            } else {
                invoice_fields.property_product_pricelist = false;
            }
            delete invoice_fields.image;
            delete invoice_fields.image_medium;
            delete invoice_fields.image_small;
            if (!has_invoice_fields) {
                invoice_fields = false;
            }
            rpc.query({
                    model: 'res.partner',
                    method: 'create_from_ui',
                    args: [fields_partner, invoice_fields],
                })
                .then(function(partner_id) {
                    self.saved_client_details(partner_id, invoice_fields);
                }, function(err, ev) {
                    ev.preventDefault();
                    var error_body = _t('Your Internet connection is probably down.');
                    if (err.data) {
                        var except = err.data;
                        error_body = except.arguments && except.arguments[0] || except.message || error_body;
                    }
                    self.gui.show_popup('error', {
                        'title': _t('Error: Could not Save Changes'),
                        'body': error_body,
                    });
                });
        },
        saved_client_details: function(partner_id , invoice_fields=false){
            if(invoice_fields){
                var self = this;
                var partner = false;
                return this.reload_partners().then(function(){
                    partner = self.pos.db.get_partner_by_id(partner_id);
                    if (partner) {
                        self.new_client = partner;
                        self.toggle_save_button();
                        self.display_client_details('show',partner,undefined,invoice_fields);
                    } else {
                        // should never happen, because create_from_ui must return the id of the partner it
                        // has created, and reload_partner() must have loaded the newly created partner. 
                        self.display_client_details('hide');
                    }
                }).always(function(){
                    $(".client-details-contents").on('click','.button.save',function(){ 
                        if(partner){
                            self.save_client_details(partner);
                        }
                    });
                });
            }else{
                this._super(partner_id , invoice_fields)
            }
        },
        display_client_details: function(visibility, partner, clickpos, invoice_fields=false) {
            var self = this;
            var order = self.pos.get_order();
            var searchbox = this.$('.searchbox input');
            var contents = this.$('.client-details-contents');
            var parent = this.$('.client-list').parent();
            var scroll = parent.scrollTop();
            var height = contents.height();
            var invoice_partner = false;
            var partner_invoice_links = self.pos.db.get_partner_invoice_links();
            if (partner && partner.pos_invoice_partner) {
                var invoice_partner_id = partner.pos_invoice_partner[0];
                if(order){
                    var partner_inv_links = order.get_partner_invoice_links();
                    if(partner_inv_links && partner_inv_links['partner_id'] == partner.id){
                        invoice_partner_id = partner_inv_links['invoice_partner_id'];
                        invoice_partner = self.pos.db.get_partner_by_id(invoice_partner_id);
                    }
                }
                var invo_partner = self.pos.db.get_partner_by_id(invoice_partner_id);
                if(invo_partner){
                    partner.pos_invoice_partner = [invo_partner.id,invo_partner.name];
                }
            }
            contents.off('change', '#invoice_address_selection');
            contents.off('click', '.button.edit');
            contents.off('click', '#new_invoice_address');
            contents.off('click', '.button.save');
            contents.off('click', '.button.undo');
            contents.on('click', '.button.edit', function() {
                self.edit_client_details(partner);
            });
            contents.on('click', '.button.save', function() {
                self.save_client_details(partner);
            });
            contents.on('click', '.button.undo', function() {
                self.undo_client_details(partner);
            });
            this.editing_client = false;
            this.uploaded_picture = null;
            if (visibility === 'show') {
                contents.empty();
                var partner_invo_links = false;
                if(partner_invoice_links && partner_invoice_links[partner.id]){
                    partner_invo_links = partner_invoice_links[partner.id];
                }
                if(invoice_fields && !invoice_partner){
                    var invo_partner_id = partner.pos_invoice_partner[0];
                    if(invoice_fields['id']){
                        invo_partner_id = invoice_fields['id'];
                    }
                    invoice_partner = self.pos.db.get_partner_by_id(invo_partner_id);
                }
                contents.append($(QWeb.render('ClientDetails', {
                    widget: this,
                    partner: partner,
                    invoice_partner: invoice_partner,
                    partner_invoice_links: partner_invo_links
                })));
                if(invoice_partner){
                    contents.find("#invoice_address_selection option[value="+ invoice_partner.id +"]").attr('selected','selected');
                    order.set_selected_links_value(invoice_partner);
                    partner.pos_invoice_partner = [invoice_partner.id,invoice_partner.name];
                }else{
                    order.set_selected_links_value(false);
                }
                contents.on('change', '#invoice_address_selection', function() {
                    var id = $(this).val();
                    invoice_partner = self.pos.db.get_partner_by_id(id);
                    if(order.get_client()){
                        var invoice_partner_dict = {'partner_id': partner.id, 'invoice_partner_id': false};
                        if(invoice_partner){
                            invoice_partner_dict['invoice_partner_id'] = invoice_partner.id;
                        }
                        order.set_partner_invoice_links(invoice_partner_dict);
                        self.display_client_details(visibility, partner, clickpos);
                    }else{
                        if(invoice_partner){
                            partner.pos_invoice_partner = [invoice_partner.id, invoice_partner.name];
                        }
                        var client_invoice_adrees_container = self.$(".client_invoice_adrees_container");
                        client_invoice_adrees_container.empty();
                        client_invoice_adrees_container.append($(QWeb.render('ClientInvoiceAddress', {
                            widget: this,
                            partner: partner,
                            invoice_partner: invoice_partner ? invoice_partner : false,
                        })));
                    }
                    order.set_selected_links_value(invoice_partner);
                });
                var new_height = contents.height();
                if (!this.details_visible) {
                    // resize client list to take into account client details
                    parent.height('-=' + new_height);
                    if (clickpos < scroll + new_height + 20) {
                        parent.scrollTop(clickpos - 20);
                    } else {
                        parent.scrollTop(parent.scrollTop() + new_height);
                    }
                } else {
                    parent.scrollTop(parent.scrollTop() - height + new_height);
                }
                this.details_visible = true;
                this.toggle_save_button();
            } else if (visibility === 'edit') {
                // Connect the keyboard to the edited field
                if (this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard) {
                    contents.off('click', '.detail');
                    searchbox.off('click');
                    contents.on('click', '.detail', function(ev) {
                        self.chrome.widget.keyboard.connect(ev.target);
                        self.chrome.widget.keyboard.show();
                    });
                    searchbox.on('click', function() {
                        self.chrome.widget.keyboard.connect($(this));
                    });
                }
                this.editing_client = true;
                contents.empty();
                if(order.get_selected_links_value()){
                    if(partner.pos_invoice_partner && partner.pos_invoice_partner[0]){
                        invoice_partner =  invoice_partner ? invoice_partner : self.pos.db.get_partner_by_id(partner.pos_invoice_partner[0]);
                    }
                }
                contents.append($(QWeb.render('ClientDetailsEdit', {
                    widget: this,
                    partner: partner,
                    invoice_partner: invoice_partner ? invoice_partner : false
                })));
                this.toggle_save_button();
                // Browsers attempt to scroll invisible input elements
                // into view (eg. when hidden behind keyboard). They don't
                // seem to take into account that some elements are not
                // scrollable.
                contents.find('input').blur(function() {
                    setTimeout(function() {
                        self.$('.window').scrollTop(0);
                    }, 0);
                });
                contents.find('.image-uploader').on('change', function(event) {
                    self.load_image_file(event.target.files[0], function(res) {
                        if (res) {
                            contents.find('.client-picture img, .client-picture .fa').remove();
                            contents.find('.client-picture').append("<img src='" + res + "'>");
                            contents.find('.detail.picture').remove();
                            self.uploaded_picture = res;
                        }
                    });
                });
                contents.on('click', '#new_invoice_address', function() {
                    self.$('.client-details-contents .invoice_detail').val("");
                    var order = self.pos.get_order();
                    order.set_partner_invoice_links(false);
                });
            } else if (visibility === 'hide') {
                contents.empty();
                parent.height('100%');
                if (height > scroll) {
                    contents.css({
                        height: height + 'px'
                    });
                    contents.animate({
                        height: 0
                    }, 400, function() {
                        contents.css({
                            height: ''
                        });
                    });
                } else {
                    parent.scrollTop(parent.scrollTop() - height);
                }
                this.details_visible = false;
                this.toggle_save_button();
            }
        },
    });

    PosDB.include({
        init: function(options){
            this.partner_invoice_links = {};
            this._super(options);
        },
        add_partners: function(partners){
            var updated_count = 0;
            var new_write_date = '';
            var partner;
            for(var i = 0, len = partners.length; i < len; i++){
                partner = partners[i];

                var local_partner_date = (this.partner_write_date || '').replace(/^(\d{4}-\d{2}-\d{2}) ((\d{2}:?){3})$/, '$1T$2Z');
                var dist_partner_date = (partner.write_date || '').replace(/^(\d{4}-\d{2}-\d{2}) ((\d{2}:?){3})$/, '$1T$2Z');
                if (    this.partner_write_date &&
                        this.partner_by_id[partner.id] &&
                        new Date(local_partner_date).getTime() + 1000 >=
                        new Date(dist_partner_date).getTime() ) {
                    // FIXME: The write_date is stored with milisec precision in the database
                    // but the dates we get back are only precise to the second. This means when
                    // you read partners modified strictly after time X, you get back partners that were
                    // modified X - 1 sec ago. 
                    continue;
                } else if ( new_write_date < partner.write_date ) { 
                    new_write_date  = partner.write_date;
                }
                if (!this.partner_by_id[partner.id]) {
                    this.partner_sorted.push(partner.id);
                }
                this.partner_by_id[partner.id] = partner;

                updated_count += 1;
            }
            this.partner_write_date = new_write_date || this.partner_write_date;
            if (updated_count) {
                // If there were updates, we need to completely 
                // rebuild the search string and the barcode indexing
                this.partner_search_string = "";
                this.partner_by_barcode = {};
                for (var id in this.partner_by_id) {
                    partner = this.partner_by_id[id];
                    if(partner.barcode){
                        this.partner_by_barcode[partner.barcode] = partner;
                    }
                    partner.address = (partner.street || '') +', '+ 
                                      (partner.zip || '')    +' '+
                                      (partner.city || '')   +', '+ 
                                      (partner.country_id[1] || '');
                    this.partner_search_string += this._partner_search_string(partner);
                    if(partner.type == "invoice" && partner.parent_id && partner.parent_id[0]){
                        var parent_id = partner.parent_id[0];
                        if(_.has(this.partner_invoice_links,parent_id)){
                            var partner_invoice_exists  = _.contains(_.pluck(this.partner_invoice_links[parent_id],'id'),partner.id);
                            if(! partner_invoice_exists){
                                this.partner_invoice_links[parent_id].push(partner);
                            }else{
                                this.partner_invoice_links[parent_id] = [partner];
                            }
                        }else{
                            this.partner_invoice_links[parent_id] = [partner];
                        }
                    }
                }
            }
            return updated_count;
        },
        get_partner_invoice_links: function(){
            return this.partner_invoice_links;
        }
    });

    var _super_order = models.Order.prototype;
    models.Order = models.Order.extend({
        initialize: function() {
            var self = this;
            self.set({
                'partner_invoice_links': false,
                'selected_links_value': false
            });
            _super_order.initialize.apply(this, arguments);
        },
        set_client: function (client) {
            var self = this;
            if(client){
                var invoice_partner_dict = {'partner_id': client.id, 'invoice_partner_id': false};
                var partner_invoice_links = self.get_partner_invoice_links();
                if(partner_invoice_links && partner_invoice_links['partner_id'] == client.id){
                    invoice_partner_dict['invoice_partner_id'] = partner_invoice_links['invoice_partner_id'];
                }else{
                    var pos_invoice_partner = client.pos_invoice_partner;
                    if(pos_invoice_partner && pos_invoice_partner[0]){
                        invoice_partner_dict['invoice_partner_id'] = pos_invoice_partner[0];
                    }
                }
                if($("#invoice_address_selection").val() != 0){
                    self.set_partner_invoice_links(invoice_partner_dict);
                }else{
                    self.set_partner_invoice_links(false);
                }
            }else{
                self.set_partner_invoice_links(false);
            }
            _super_order.set_client.apply(self, arguments);
        },
        set_selected_links_value : function(selected_links_value){
            this.set('selected_links_value',selected_links_value);
            this.trigger('change',this);
        },
        get_selected_links_value: function() {
            return this.get('selected_links_value') ? this.get('selected_links_value') : false;
        },
        set_partner_invoice_links: function(partner_invoice_links) {
            this.set('partner_invoice_links', partner_invoice_links);
            this.trigger('change',this);
        },
        get_partner_invoice_links: function() {
            return this.get('partner_invoice_links');
        },
        export_as_JSON: function() {
            var json = _super_order.export_as_JSON.apply(this, arguments);
            json.partner_invoice_links = (this.get_partner_invoice_links() && this.get_partner_invoice_links()['invoice_partner_id'])? this.get_partner_invoice_links()['invoice_partner_id']:false;
            json.partner_invo_links = this.get_partner_invoice_links();
            return json;
        },
        init_from_JSON: function(json) {
            _super_order.init_from_JSON.apply(this, arguments);
            if (json.partner_invo_links) {
                this.set_partner_invoice_links(json.partner_invo_links);
            }
        },
    });

});