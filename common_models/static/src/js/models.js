/**
 * Created by derid on 11/01/2018.
 */
odoo.define('common_models.models', function (require) {
    'use strict';

    var Class = require('web.Class');
    var rpc = require('web.rpc');
    var BasicModel = require('web.BasicModel');


    /**
     * ProductModelFilter
     * Represent a O4F.ProductModelFilter object from the Odoo Backend
     * @type {OdooClass}
     */
    var ProductModelFilter = Class.extend({
        init: function (values) {
            Object.assign(this, values);
        },
        fetchModels: function () {
            var self = this;
            return rpc.query({
                model: 'product.template',
                method: 'search_read',
                fields: ['name']
            }).then(function (product_templates) {
                var values = product_templates[0];
                Object.assign(self, values);
                return self;
            });
        },
    });

    /**
     * O4FWidget
     * Represent a O4FWidget object
     * @type {OdooClass}
     */
    var O4FWidgetModel = BasicModel.extend({
        avoidCreate: false,
        quickCreateFields: ['product_model_filter_id', 'models', 'record_id', 'state', 'common_quantity_name', 'common_lines_name', 'changes', 'product_attribute_id'],
        /**
         * @override
         */
        init: function () {
            this._super.apply(this, arguments);
            this.product_model_filter_id = false;
            this.models = [];
        },
        triggerCompute: function (model, res_id) {
            var self = this;
            return rpc.query({
                model: model,
                method: 'order_compute',
                args: [res_id],
            }).then(function () {
                return self;
            });
        },
        fetchDocModels: function (model, record_id) {
            var self = this;
            return rpc.query({
                model: model,
                method: 'get_model_lines',
                args: [record_id],
            }).then(function (measurebars) {
                self.models = measurebars;
                return self;
            });
        },
        fetchModel: function (model, model_fields) {
            var self = this;
            return rpc.query({
                model: model,
                method: 'new_model_defaults',
                args: model_fields,
            }).then(function (model_bar) {
                var order_model_id = self._idGenerator();
                model_bar.order_model_id = order_model_id;
                if (self.models == false) {
                    self.models = [];
                }
                self.models.unshift(model_bar);

                return model_bar;
            });
        },
        saveModels: function (model, models, res_id) {
            var self = this;
            return rpc.query({
                model: model,
                method: 'write_model_lines',
                args: [models, res_id],
            }).then(function (model_bar) {
                return self;
            });
        },
        createModel: function (name, price, cost, size_attribute, color_attribute, collection, brand) {
            var self = this;
            return rpc.query({
                model: 'product.template',
                method: 'create_model',
                args: [name, price, cost, size_attribute, color_attribute, collection, brand],
            }).then(function (product) {
                return product;
            });
        },
        getCommonNames: function (model, record_id) {
            var self = this;
            return rpc.query({
                model: model,
                method: 'get_odoo4fashion_keys',
                args: [record_id]
            }).then(function (vals) {
                return vals;
            })
        },
        getDefaultPricelist: function (model) {
            var self = this;
            return rpc.query({
                model: model,
                method: 'get_default_pricelist_id',
            }).then(function (vals) {
                return vals;
            })
        },
        getDefaultWarehouse: function (model) {
            var self = this;
            return rpc.query({
                model: model,
                method: 'get_default_warehouse_id',
            }).then(function (vals) {
                return vals;
            })
        },
        _idGenerator: function () {

            this.length = 8;
            this.timestamp = +new Date;

            var _getRandomInt = function (min, max) {
                return Math.floor(Math.random() * (max - min + 1)) + min;
            };


            var ts = this.timestamp.toString();
            var parts = ts.split("").reverse();
            var id = "";

            for (var i = 0; i < this.length; ++i) {
                var index = _getRandomInt(0, parts.length - 1);
                id += parts[index];
            }

            return id;


        },

    });
    return {
        O4FWidgetModel: O4FWidgetModel,
        ProductModelFilter: ProductModelFilter,
    };
});