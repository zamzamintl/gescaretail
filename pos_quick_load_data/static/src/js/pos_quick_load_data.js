odoo.define('pos_quick_load_data.pos_quick_load_data', function(require) {
    "use strict";

    var ajax = require('web.ajax');
    var core = require('web.core');
    var models = require('point_of_sale.models');
    var session = require('web.session');
    var _t = core._t;

    var is_pos_discount_management_install = _.contains(session.module_list, 'pos_discount_management');
    var is_pos_loyalty_amount_install = _.contains(session.module_list, 'pos_loyalty_amount');
    var is_pos_stock_grid_install = _.contains(session.module_list, 'pos_stock_grid');
    var is_pos_product_list_view_install = _.contains(session.module_list, 'pos_product_list_view');
    var is_pos_invoice_client = _.contains(session.module_list, 'pos_invoice_client');
    
    var is_product_attribute_type_install= _.contains(session.module_list, 'product_attribute_type');
    var is_product_collections_install = _.contains(session.module_list, 'product_collections');
    var is_product_brand_install = _.contains(session.module_list, 'product_brand');
    var is_product_gender_install = _.contains(session.module_list, 'product_gender');
    var is_product_variant_prices_install = _.contains(session.module_list, 'product_variant_prices');

    var posmodel_super = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        load_server_data: function() {
            var self = this;
            for (var i = 0; i < this.models.length; i++) {
                if (this.models[i].model == 'res.partner' || this.models[i].model == 'product.product') {
                    this.models.splice(i, 1);
                }
            }
            return posmodel_super.load_server_data.apply(this, arguments).then(function() {
                ajax.jsonRpc('/web/partner_load', 'call', {
                    'pos_fixed_discount': is_pos_discount_management_install,
                    'is_pos_loyalty_amount_install': is_pos_loyalty_amount_install,
                    'is_pos_invoice_client': is_pos_invoice_client
                }).done(function(partners) {
                    var partner_data_list = [];
                    _.map(partners, function(lpartner) {
                        partner_data_list.push(_.mapObject(lpartner, function(v, k) {
                            if (v == null) {
                                return false;
                            } else if (_.isArray(v)) {
                                if (v.length > 1) {
                                    return [parseInt(v[0]), v[1]];
                                } else {
                                    return v;
                                }
                            } else {
                                return v;
                            }
                        }));
                    });
                    self.partners = partner_data_list;
                    self.partner_list = partner_data_list;
                    self.partner_dict = {};
                    _.each(partner_data_list, function(value) {
                        self.partner_dict[parseInt(value.id)] = value;
                    });
                    self.db.add_partners(partner_data_list);
                });
                self.chrome.loading_message(_t('Loading') + ' product.product', 1);
                return ajax.jsonRpc('/web/product_load', 'call', {
                    'is_pos_discount_management': is_pos_discount_management_install,
                    'is_pos_loyalty_amount_install': is_pos_loyalty_amount_install,
                    'is_pos_stock_grid_install' : is_pos_stock_grid_install,
                    'is_pos_product_list_view_install' : is_pos_product_list_view_install,
                    'is_product_attribute_type_install':is_product_attribute_type_install,
                    'is_product_collections_install': is_product_collections_install,
                    'is_product_brand_install': is_product_brand_install,
                    'is_product_gender_install':is_product_gender_install,
                    'is_product_variant_prices_install':is_product_variant_prices_install,
                }).done(function(products) {
                    var product_list = [];
                    _.map(products, function(lproduct) {
                        product_list.push(_.mapObject(lproduct, function(v, k) {
//                            if (k == 'price') {
//                                return self.get_price(self.default_pricelist, 1, lproduct);
//                            }
                            if (v == null) {
                                return false;
                            } else if (_.isArray(v)) {
                                if (v.length > 1) {
                                    return [parseInt(v[0]), v[1]];
                                } else {
                                    return v;
                                }
                            } else {
                                return v;
                            }
                        }));
                    })
                    var using_company_currency = self.config.currency_id[0] === self.company.currency_id[0];
                    var conversion_rate = self.currency.rate / self.company_currency.rate;
                    self.db.add_products(_.map(product_list, function (product) {
                        if (!using_company_currency) {
                            product.lst_price = round_pr(product.lst_price * conversion_rate, self.currency.rounding);
                        }
                        product.categ = _.findWhere(self.product_categories, {'id': product.categ_id[0]});
                        return new models.Product({}, product);
                    }));
                    self.all_product = product_list;
                });
            });
        },
        load_new_partners: function() {
            var self = this;
            var temp = self.db.get_partner_write_date();
            var def = new $.Deferred();
            self.chrome.loading_message(_t('Loading') + ' res.partner', 1);
            ajax.jsonRpc('/web/partner_load', 'call', {
                'date': temp,
                'pos_fixed_discount': is_pos_discount_management_install,
                'is_pos_loyalty_amount_install': is_pos_loyalty_amount_install,
                'is_pos_invoice_client': is_pos_invoice_client
            }).done(function(partners) {
                var partner_data_list = [];
                _.map(partners, function(lpartner) {
                    partner_data_list.push(_.mapObject(lpartner, function(v, k) {
                        if (v == null) {
                            return false;
                        } else if (_.isArray(v)) {
                            if (v.length > 1) {
                                return [parseInt(v[0]), v[1]];
                            } else {
                                return v;
                            }
                        } else {
                            return v;
                        }
                    }));
                });
                if (self.db.add_partners(partner_data_list)) {
                    _.each(partner_data_list, function(partner) {
                        if (!self.partner_list) {
                            self.partner_list = [];
                        }
                        if (!self.partner_dict) {
                            self.partner_dict = {};
                        }
                        self.partner_list.push(partner);
                        self.partner_dict[parseInt(partner.id)] = partner;
                    });
                    def.resolve();
                } else {
                    def.reject();
                }
            });
            return def
        },
    });

});