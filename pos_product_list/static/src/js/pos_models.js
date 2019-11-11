odoo.define("pos_product_list.pos_product_list", function(require) {
    "use strict"

    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');

    function load_sort_order(model_name, sort_order) {
        if (!(sort_order instanceof Array)) {
            sort_order = [sort_order];
        }
        var omodels = models.PosModel.prototype.models;
        for (var i = 0; i < omodels.length; i++) {
            var model = omodels[i];
            if (model.model === model_name) {
                model.order = _.map(sort_order, function(name) {
                    return {
                        name: name
                    };
                })
            }
        }
    }
    load_sort_order('product.product', ['name', 'id', 'sequence', 'default_code']);

    models.Orderline = models.Orderline.extend({
        get_all_prices: function(product_list=false, product_list_price=false){
            var price_unit = this.get_unit_price() * (1.0 - (this.get_discount() / 100.0));
            price_unit = product_list_price ? product_list_price : price_unit;
            var taxtotal = 0;
            var product =  this.get_product();
            product =  product_list ? product_list : product;
            var taxes_ids = product.taxes_id;
            var taxes =  this.pos.taxes;
            var taxdetail = {};
            var product_taxes = [];
            _(taxes_ids).each(function(el){
                product_taxes.push(_.detect(taxes, function(t){
                    return t.id === el;
                }));
            });
            var all_taxes = this.compute_all(product_taxes, price_unit, this.get_quantity(), this.pos.currency.rounding);
            _(all_taxes.taxes).each(function(tax) {
                taxtotal += tax.amount;
                taxdetail[tax.id] = tax.amount;
            });
            if(product_list){
                return all_taxes.total_included
            }
            return {
                "priceWithTax": all_taxes.total_included,
                "priceWithoutTax": all_taxes.total_excluded,
                "tax": taxtotal,
                "taxDetails": taxdetail,
            };
        },
    });

    screens.ProductListWidget.include({
        get_tax_incl_price: function(product, price) {
            if(this.line){
                return this.line.get_all_prices(product, price);
            }
            var order = this.pos.get_order();
            if(order){
                this.line = new models.Orderline({}, {pos: this.pos, order: order, product: product});
            }else{
                return price;
            }
            return this.line.get_all_prices(product, price);
        },
    });

});