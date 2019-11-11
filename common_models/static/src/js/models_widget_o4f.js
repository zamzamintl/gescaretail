odoo.define('common_models.O4FWidget', function (require) {
    "use strict";
    var core = require('web.core');
    var Widget = require('web.Widget');
    var widget_registry = require('web.widget_registry');
    var FieldManagerMixin = require('web.FieldManagerMixin');
    var session = require('web.session');
    var local_storage = require('web.local_storage');
    var config = require('web.config');
    var time = require('web.time');
    var utils = require('web.utils');
    var rpc = require('web.rpc');
    var BasicModel = require('web.BasicModel');
    var relational_fields = require('web.relational_fields'); // relatie velden
    var basic_fields = require('web.basic_fields'); // gewone velden
    var O4FWidgetModel = require('common_models.models').O4FWidgetModel;
    var QWeb = core.qweb;
    var _t = core._t;
    var BasicModel = require('web.BasicModel');
    /*
     * Many2one: usage FieldMany2One(self, model, record, options)
     */

    var O4FWidget = Widget.extend(FieldManagerMixin, {
        template: 'O4FWidget',
        events: {
            'click .oe_models_add_row button': '_addModelBar',
            'change .oe_product_cell': "_changeProductQty",
            'click .row_delete': '_removeModel',
            'change .o4f_comment': '_changeModelComment',
            'dblclick .product_price': '_toInputField',
            'change .input_price': '_changeProductPrice',
            'change .o4f_discount': '_changeModelDiscount',
            'click .o4f_model_price': '_changeModelPrice',
            'click #show_quick_create': '_showQuickCreate',
            'click #save_qc': '_createModel',
            'click #save_qc_copy': '_saveCopyQuickCreate',
            'click #close_qc': '_closeQuickCreate',
            'click h4>a': '_goToProductTemplate',
            'click .info-collapseable .fa-info-circle': '_openInfo'

        },
        custom_events: _.extend(
            {}, FieldManagerMixin.custom_events, {
                'field_changed': '_onFieldChanged',
            }),
        init: function (parent, model) {
            this._super(parent);
            FieldManagerMixin.init.call(this);
            //this.model = new O4FWidgetModel();
            var self = this;
            self.parent = parent;
            self.model = model;
            self.O4FWidgetModel = new O4FWidgetModel();
            self.O4FWidgetModel.record_id = model.res_id;
            self.O4FWidgetModel.state = parent.mode;
            self.O4FWidgetModel.changes = false;
            self.O4FWidgetModel.formatValues = self.formatValues;
            self.O4FWidgetModel.model = self.model.model;
            self.O4FWidgetModel.models = [];
            self.O4FWidgetModel.saveState = false;
            self.O4FWidgetModel.edit_states = ['draft'];
            self.O4FWidgetModel.docstate = 'draft';

            //Save O4F models before saving the rest of the form
            var form = this.getParent();
            while (form && (!form.saveRecord)) {
                form = form.getParent();
            }
            // var _formSave = form._saveRecord;
            var record = this.getParent();
            while (record && (!record.saveRecord)) {
                record = record.getParent();
            }
        },

        createOrderLine: function (record, v_productline, order_model_id, changes, field_names) {
            //TODO improvments
            if (v_productline == 0) {
                return false;
            }
            var self = this;
            var line_name = self.O4FWidgetModel.model_common_lines_name;
            var line = {};
            var product_save_line = jQuery.extend(true, {}, v_productline);
            product_save_line.line.order_model_id = parseInt(order_model_id);
            if ('order_id' in v_productline.line == false) {
                v_productline.line.order_model_id = order_model_id;
            }
            product_save_line.line.product_id =
                {
                    id: v_productline.line.product_id,
                    display_name: 'DUMMY'
                }
            ;
            if ('product_uom' in product_save_line.line) {
                product_save_line.line.product_uom =
                    {
                        id: v_productline.line.product_uom,
                        display_name: 'DUMMY'
                    }
                ;
            }
            if (this.model.model == "account.invoice") {
                product_save_line.line.account_id = {
                    operation: 'LINK_TO',
                    id: v_productline.line.account_id,
                };
                var values = _.map(product_save_line.line.invoice_line_tax_ids, function (id) {
                    return {id: id};
                });
                product_save_line.line.invoice_line_tax_ids = {
                    operation: 'ADD_M2M',
                    ids: values,
                };
            }
            if (this.model.model == "sale.order") {
                var values = _.map(product_save_line.line.tax_id, function (id) {
                    return {id: id};
                });
                product_save_line.line.tax_id = {
                    operation: 'ADD_M2M',
                    ids: values,
                };
            }
            if (this.model.model == "purchase.order") {
                var values = _.map(v_productline.line.taxes_id, function (id) {
                    return {id: id};
                });
                product_save_line.line.taxes_id = {
                    operation: 'ADD_M2M',
                    ids: values,
                };
            }
            product_save_line.line['price_unit'] = parseFloat(product_save_line.line['price_unit']);
            line[line_name] = {
                operation: 'CREATE',
                data: product_save_line.line

            };

            return line
        },
        saveOrderLine: function (record, v_productline, order_model_id, changes, field_names) {
            if (v_productline == 0) {
                return false;
            }
            var self = this;
            var virtual_id = false;
            var line = {};
            if (!'order_id' in v_productline.line == false) {
                v_productline.line.order_model_id = order_model_id;
            }
            var line_data = {};
            for (var prop in field_names) {
                line_data[field_names[prop]] = v_productline.line[field_names[prop]];
            }
            if (self.model.model == 'sale.order') {
                line_data['qty_invoiced'] = 0;
            }

            if ('virtual_id' in v_productline.line == false) {
                virtual_id = self._getVirtualLineID(record, v_productline.line.id, v_productline);
                v_productline.virtual_id = virtual_id;
            } else {
                virtual_id = v_productline.virtual_id;
            }

            line[self.O4FWidgetModel.model_common_lines_name] = {
                operation: 'UPDATE',
                id: virtual_id,
                data: line_data
            };
            return record.model.notifyChanges(record.handle, line, {notifyChange: false})
        },
        deleteOrderLine: function (record, v_productline) {
            var self = this;
            var line_name = self.O4FWidgetModel.common_lines_name;
            var line = {};
            line[line_name] = {
                operation: 'DELETE',
                ids: [self._getVirtualLineID(record, v_productline.line.id, v_productline)],
            };
            if (Object.keys(line).length > 0) {
                record.model.notifyChanges(record.handle, line, {notifyChange: false})
            }
        },
        start: function () {
            //data renderen
            var self = this;
            self.$el.html(QWeb.render("O4FWidget", {widget: self.O4FWidgetModel}));
            var def1 = this._makeModelRecord(undefined, undefined).then(function (recordID) {
                self.fields = {
                    product_filter_model_id: new relational_fields.FieldMany2One(self,
                        'product_filter_model_id',
                        self.O4FWidgetModel.get(recordID),
                        {mode: 'edit'}
                    )
                };
                if (self.O4FWidgetModel.state == 'edit') {
                    self.fields.product_filter_model_id.appendTo(self.$('.product_id_field'));
                }

            });

            var def2 = this._super.apply(this, arguments);
            return $.when(def1, def2);
        },
        willStart: function () {
            var self = this;
            self.O4FWidgetModel.getCommonNames(self.model.model, self.model.res_id).then(function (result) {
                self.O4FWidgetModel.common_quantity_name = result['quantity'];
                self.O4FWidgetModel.common_lines_name = result['common_object_line_name'];
                self.O4FWidgetModel.model_common_lines_name = result['model_common_lines_name'];
                self.O4FWidgetModel.model_line_tax_name = result['tax_id'];
                self.O4FWidgetModel.model_warehouse_name = result['model_warehouse_name'];
                self.O4FWidgetModel.model_line_discount_name = result['discount'];
                self.O4FWidgetModel.model_date_order_name = result['model_date_order'];
                self.O4FWidgetModel.model_partner_id_name = result['model_partner_id'];
                self.O4FWidgetModel.model_fiscal_position_id_name = result['model_fiscal_position_id'];
                self.O4FWidgetModel.model_state_name = result['model_state'];
                self.O4FWidgetModel.model_pricelist_id_name = result['model_pricelist_id'];
                self.O4FWidgetModel.model_doc_type_name = result['model_doc_type_name'];
                if (self.O4FWidgetModel.model_pricelist_id_name == 'no') {
                    self.O4FWidgetModel.getDefaultPricelist(self.model.model).then(function (result_pricelist) {
                        self.O4FWidgetModel.default_pricelist_id = result_pricelist;
                    });
                }
                if (self.O4FWidgetModel.model_warehouse_name == 'no') {
                    self.O4FWidgetModel.getDefaultWarehouse(self.model.model).then(function (result_warehouse) {
                        self.O4FWidgetModel.default_warehouse_id = result_warehouse;
                    });
                }
                self.O4FWidgetModel.edit_states = result['model_edit_states'];
                self.O4FWidgetModel.docstate = self._getParentField(result['model_state']).value;

                self.O4FWidgetModel.model_line_fields = [];
                var record = self.getParent().getParent();
                for (var element in record.model.localData) {
                    if (record.model.localData[element].model == self.O4FWidgetModel.common_lines_name) {
                        for (var prop in record.model.localData[element].fields) {
                            for (var element_prop in record.model.localData[element].fields[prop]) {
                                if (element_prop == 'type') {
                                    var type_prop = record.model.localData[element].fields[prop][element_prop];
                                    if (type_prop != 'many2many' && type_prop != 'many2one' && type_prop != 'one2many') {
                                        self.O4FWidgetModel.model_line_fields.push(prop);
                                        break;
                                    }
                                }
                            }

                        }
                        break;
                    }
                }
            });

            return $.when(this._super.apply(this, arguments),
                this.O4FWidgetModel.fetchDocModels(this.model.model, this.model.res_id)
            )
        },
        _goToProductTemplate: function () {
            var self = this;
            var id = parseInt($(event.target).attr('data-id'));
            this._rpc({
                model: 'product.template',
                method: 'get_formview_action',
                args: [[id]],
            })
                .then(function (action) {
                    self.trigger_up('do_action', {action: action});
                });
        },
        _showQuickCreate: function () {
            var self = this;
            self.$(".oe_models_quick_create").show();
            if ('product_filter_model_id' in self.fields == false) {
                self._makeModelRecord(undefined, undefined).then(function (recordID) {
                    self.fields.product_filter_model_id.reset(self.O4FWidgetModel.get(recordID));
                    self.fields.product_filter_model_id =
                        new relational_fields.FieldMany2One(self,
                            'product_filter_model_id',
                            self.O4FWidgetModel.get(recordID),
                            {mode: 'edit'}
                        );
                    self.fields.product_filter_model_id.appendTo(self.$('.product_id_field'));
                });
            }
            if ('product_attribute_color_id' in self.fields == false) {
                self._makeAttributeColorRecord(undefined, undefined).then(function (recordID) {
                    self.fields.product_attribute_color_id =
                        new relational_fields.FieldMany2One(self,
                            'product_attribute_color_id',
                            self.O4FWidgetModel.get(recordID),
                            {mode: 'edit'}
                        );
                    self.fields.product_attribute_color_id.appendTo(self.$('#qc_model_color_attribute'));
                });
            }
            if ('product_attribute_size_id' in self.fields == false) {
                self._makeAttributeSizeRecord(undefined, undefined).then(function (recordID) {
                    self.fields.product_attribute_size_id =
                        new relational_fields.FieldMany2One(self,
                            'product_attribute_size_id',
                            self.O4FWidgetModel.get(recordID),
                            {mode: 'edit'}
                        );
                    self.fields.product_attribute_size_id.appendTo(self.$('#qc_model_size_attribute'));
                });
            }
            if ('product_brand_id' in self.fields == false) {
                self._makeBrandRecord(undefined, undefined).then(function (recordID) {
                    self.fields.product_brand_id =
                        new relational_fields.FieldMany2One(self,
                            'product_brand_id',
                            self.O4FWidgetModel.get(recordID),
                            {mode: 'edit'}
                        );

                    self.fields.product_brand_id.appendTo(self.$('#qc_model_brand'));
                });
            }
            if ('product_collection_id' in self.fields == false) {
                self._makeCollectionRecord(undefined, undefined).then(function (recordID) {
                    self.fields.product_collection_id =
                        new relational_fields.FieldMany2One(self,
                            'product_collection_id',
                            self.O4FWidgetModel.get(recordID),
                            {mode: 'edit'}
                        );
                    self.fields.product_collection_id.appendTo(self.$('#qc_model_collection'));
                });
            }
        },
        _closeQuickCreate: function () {
            $('#qc_model_name').text = '';
            $('#qc_model_price').val('0.00');
            $('#qc_model_cost').val('0.00');

            self.$(".oe_models_quick_create").hide();

        },
        _saveCopyQuickCreate: function () {
            var self = this;
            var partner_id = self._getParentField('partner_id');
            var record = this.getParent();
            while (record && (!record.saveRecord)) {
                record = record.getParent();
            }
            if (!partner_id.value.data.id) {
                alert("Partner Not set");
                return;
            }
            if ($('#qc_model_name').val() === "" || (self.model.fields.product_attribute_color_id === false && self.model.fields.product_attribute_size_id === false)) {
                if ($('#qc_model_name').val() === "") {
                    $('#qc_name_error').text('Name Required');
                }
                if (self.attri_m2o.get_value() === false) {
                    $('#qc_attribute_error').text('Attribute Required');
                }
                if (self.collection_m2o.get_value() === false) {
                    $('#qc_collection_error').text('Collection Required');
                }
                if (self.brand_m2o.get_value() === false) {
                    $('#qc_brand_error').text('Brand Required');
                }

            } else {
                var name = $('#qc_model_name').val();
                var price = $('#qc_model_price').val();
                var cost = $('#qc_model_cost').val();
                if (this.fields.product_attribute_color_id.value != undefined)
                    var color_attribute = this.fields.product_attribute_color_id.value.data.id || false;
                if (this.fields.product_attribute_size_id.value != undefined)
                    var size_attribute = this.fields.product_attribute_size_id.value.data.id || false;
                var collection = this.fields.product_collection_id.value.data.id;
                var product_brand_id = this.fields.product_brand_id.value.data.id;
                this.O4FWidgetModel.createModel(name, price, cost, size_attribute, color_attribute, collection, product_brand_id).then(function (model) {
                    var model_fields = [];
                    model_fields.push(partner_id.value.data.id);
                    //pricelist_id
                    model_fields.push(1);
                    //date_order
                    model_fields.push(self._getParentField('date_order').value.format('L'));
                    //fiscal_position_id
                    model_fields.push(self._getParentField('fiscal_position_id').value.data.id);
                    //state
                    model_fields.push(self._getParentField('state').value);
                    //product_template_id
                    model_fields.push(model);
                    self.O4FWidgetModel.fetchModel(self.model.model, model_fields).then(function (model) {
                        //var order_model_id = self._idGenerator();
                        //v_measurebar.order_model_id = order_model_id;
                        var order_model_id = self._idGenerator();
                        model.order_model_id = order_model_id;
                        var line;
                        _.each(model.products, function (v_productbar, k_productbar) {
                            if (v_productbar != 0) {
                                _.each(v_productbar, function (v_productline) {
                                    if (v_productline != 0) {
                                        line = self.createOrderLine(record, v_productline, order_model_id);
                                        record.model.notifyChanges(record.handle, line, {notifyChange: false})
                                    }
                                });

                            }
                        });
                        //render measurebar
                        self.$el.html(QWeb.render("O4FWidget", {widget: self.O4FWidgetModel}));
                        //re-add many2one field product
                        self._makeModelRecord(undefined, undefined).then(function (recordID) {
                            self.fields.product_filter_model_id.reset(self.O4FWidgetModel.get(recordID));
                            self.fields.product_filter_model_id =
                                new relational_fields.FieldMany2One(self,
                                    'product_filter_model_id',
                                    self.O4FWidgetModel.get(recordID),
                                    {mode: 'edit'}
                                );
                            self.fields.product_filter_model_id.appendTo(self.$('.product_id_field'));
                        });
                        self._showQuickCreate();
                        self._makeAttributeColorRecord(self.fields.product_attribute_color_id.value.data.id, self.fields.product_attribute_color_id.value.data.display_name).then(function (recordID) {
                            self.fields.product_attribute_color_id =
                                new relational_fields.FieldMany2One(self,
                                    'product_attribute_color_id',
                                    self.O4FWidgetModel.get(recordID),
                                    {mode: 'edit'}
                                );
                            self.fields.product_attribute_color_id.appendTo(self.$('#qc_model_color_attribute'));
                        });


                        self._makeAttributeSizeRecord(self.fields.product_attribute_size_id.value.data.id, self.fields.product_attribute_size_id.value.data.display_name).then(function (recordID) {
                            self.fields.product_attribute_size_id =
                                new relational_fields.FieldMany2One(self,
                                    'product_attribute_size_id',
                                    self.O4FWidgetModel.get(recordID),
                                    {mode: 'edit'}
                                );
                            self.fields.product_attribute_size_id.appendTo(self.$('#qc_model_size_attribute'));
                        });

                        self._makeBrandRecord(self.fields.product_brand_id.value.data.id, self.fields.product_brand_id.value.data.display_name).then(function (recordID) {
                            self.fields.product_brand_id =
                                new relational_fields.FieldMany2One(self,
                                    'product_brand_id',
                                    self.O4FWidgetModel.get(recordID),
                                    {mode: 'edit'}
                                );

                            self.fields.product_brand_id.appendTo(self.$('#qc_model_brand'));
                        });
                        self._makeCollectionRecord(self.fields.product_collection_id.value.data.id, self.fields.product_collection_id.value.data.display_name).then(function (recordID) {
                            self.fields.product_collection_id =
                                new relational_fields.FieldMany2One(self,
                                    'product_collection_id',
                                    self.O4FWidgetModel.get(recordID),
                                    {mode: 'edit'}
                                );
                            self.fields.product_collection_id.appendTo(self.$('#qc_model_collection'));
                        });

                    });
                });
            }
        },
        _createModel: function () {
            var self = this;
            var partner_id = self._getParentField('partner_id');
            var record = this.getParent();
            while (record && (!record.saveRecord)) {
                record = record.getParent();
            }
            if (!partner_id.value.data.id) {
                alert("Partner Not set");
                return;
            }
            if ($('#qc_model_name').val() === "" || (self.fields.product_attribute_color_id === false && self.fields.product_attribute_size_id === false)) {
                if ($('#qc_model_name').val() === "") {
                    $('#qc_name_error').text('Name Required');
                }

            } else {
                var name = $('#qc_model_name').val();
                var price = $('#qc_model_price').val();
                var cost = $('#qc_model_cost').val();
                if ((self.fields.product_attribute_color_id.value === undefined && self.fields.product_attribute_size_id.value === undefined)) {
                    alert('Measurebar is Required');
                    return
                }
                if (this.fields.product_collection_id.value == undefined) {
                    alert('Collection is Required');
                    return;
                }
                if (this.fields.product_brand_id.value == undefined) {
                    alert('Brand is Required');
                    return;
                }
                if (this.fields.product_attribute_color_id.value != undefined)
                    var color_attribute = this.fields.product_attribute_color_id.value.data.id || false;
                if (this.fields.product_attribute_size_id.value != undefined)
                    var size_attribute = this.fields.product_attribute_size_id.value.data.id || false;
                var collection = this.fields.product_collection_id.value.data.id;
                var product_brand_id = this.fields.product_brand_id.value.data.id;
                this.O4FWidgetModel.createModel(name, price, cost, size_attribute, color_attribute, collection, product_brand_id).then(function (model) {
                    var model_fields = [];
                    model_fields.push(partner_id.value.data.id);
                    //pricelist_id
                    model_fields.push(1);
                    //date_order
                    model_fields.push(self._getParentField('date_order').value.format('L'));
                    //fiscal_position_id
                    model_fields.push(self._getParentField('fiscal_position_id').value.data.id);
                    //state
                    model_fields.push(self._getParentField('state').value);
                    //product_template_id
                    model_fields.push(model);
                    self.O4FWidgetModel.fetchModel(self.model.model, model_fields).then(function (model) {
                        //var order_model_id = self._idGenerator();
                        //v_measurebar.order_model_id = order_model_id;
                        var order_model_id = self._idGenerator();
                        model.order_model_id = order_model_id;
                        var line;
                        _.each(model.products, function (v_productbar, k_productbar) {
                            if (v_productbar != 0) {
                                _.each(v_productbar, function (v_productline) {
                                    if (v_productline != 0) {

                                        line = self.createOrderLine(record, v_productline, order_model_id);
                                        record.model.notifyChanges(record.handle, line, {notifyChange: false})
                                    }
                                });
                            }
                        });
                        //render measurebar
                        self.$el.html(QWeb.render("O4FWidget", {widget: self.O4FWidgetModel}));
                        //re-add many2one field product
                        self._makeModelRecord(undefined, undefined).then(function (recordID) {
                            self.fields.product_filter_model_id.reset(self.O4FWidgetModel.get(recordID));
                            self.fields = {
                                product_filter_model_id: new relational_fields.FieldMany2One(self,
                                    'product_filter_model_id',
                                    self.O4FWidgetModel.get(recordID),
                                    {mode: 'edit'}
                                )
                            };
                            self.fields.product_filter_model_id.appendTo(self.$('.product_id_field'));
                        });
                        self._closeQuickCreate();

                    });
                });
            }

        },
        formatValues: function (value) {
            return parseFloat(Math.round(value * 100) / 100).toFixed(2);
        },
        _toInputField: function () {
            var self = this;
            if (self.O4FWidgetModel.state != 'edit') {
                return;
            }
            if (self.O4FWidgetModel.docstate in Object.keys(self.O4FWidgetModel.edit_states)) {
                return;
            }
            var price = event.target.innerText;
            var product_id = self._getIDFromClass(event.target, 'product-');
            $(event.target).replaceWith("<input class='input_price product-" + product_id + "' type='number' value='" + price + "'></input>");

        },
        _removeModel: function (event) {
            var self = this;
            var line = {};
            var ids = [];
            var line_name = self.O4FWidgetModel.model_common_lines_name;
            var record = this.getParent();
            while (record && (!record.saveRecord)) {
                record = record.getParent();
            }
            var model_element = $(event.currentTarget).closest('.oe_model_row');
            var model_id = self._getIDFromClass($(model_element).find("input[name='model-comment']")[0], 'modelbar-');
            var toDeleteIndex;
            _.each(self.O4FWidgetModel.models, function (v_measurebar, k_measurebar) {
                if (v_measurebar.order_model_id == model_id) {
                    toDeleteIndex = k_measurebar;
                    _.each(v_measurebar.products, function (v_productbar, k_productbar) {
                        if (v_productbar != 0) {
                            _.each(v_productbar, function (v_productline) {
                                if (v_productline != 0) {
                                    ids.push(self._getVirtualLineID(record, v_productline.line.id, v_productline));
                                }
                            });
                        }
                    });
                }

            });
            self.O4FWidgetModel.models.splice(toDeleteIndex, 1);
            line[line_name] = {
                operation: 'DELETE',
                ids: ids,
            };
            if (Object.keys(line).length > 0) {
                record.model.notifyChanges(record.handle, line).then(function () {
                    //record.update({}, {reload: false});
                });
            }
            self.$el.html(QWeb.render("O4FWidget", {widget: self.O4FWidgetModel}));
            //re-add many2one field product
            self._makeModelRecord(undefined, undefined).then(function (recordID) {
                self.fields.product_filter_model_id.reset(self.O4FWidgetModel.get(recordID));
                self.fields = {
                    product_filter_model_id: new relational_fields.FieldMany2One(self,
                        'product_filter_model_id',
                        self.O4FWidgetModel.get(recordID),
                        {mode: 'edit'}
                    )
                };
                self.fields.product_filter_model_id.appendTo(self.$('.product_id_field'));
            });
        },
        _changeModelPrice: function () {
            var self = this;
            if (event) {
                event.preventDefault();
            }
            var record = this.getParent();
            while (record && (!record.saveRecord)) {
                record = record.getParent();
            }
            var model_element = $(event.target);
            var product_id = self._getIDFromClass($(model_element)[0], 'product-');
            var model_element = $(event.target).closest('.oe_model_row');
            var model_id = self._getIDFromClass($(model_element).find("input[name='model-comment']")[0], 'modelbar-');
            var input_price = parseFloat($(model_element).find("input[name='model-price']")[0].value);
            _.each(self.O4FWidgetModel.models, function (v_measurebar, k_measurebar) {
                if (v_measurebar.order_model_id == model_id) {
                    _.each(v_measurebar.products, function (v_productbar, k_productbar) {
                        if (v_productbar != 0) {
                            _.each(v_productbar, function (v_productline) {
                                if (v_productline != 0) {
                                    v_productline.line.price_unit = input_price;
                                    v_measurebar.has_changes = true;
                                    $(event.target).replaceWith("<span class='product_price product-" + product_id + "'>" + event.target.value + "</span>");
                                    self.saveOrderLine(record, v_productline, v_measurebar.order_model_id, v_measurebar.has_changes, ['price_unit']);
                                }
                            });

                        }
                    });
                }

            });
            self.$el.html(QWeb.render("O4FWidget", {widget: self.O4FWidgetModel}));
            //re-add many2one field product
            self._makeModelRecord(undefined, undefined).then(function (recordID) {
                self.fields.product_filter_model_id.reset(self.O4FWidgetModel.get(recordID));
                self.fields = {
                    product_filter_model_id: new relational_fields.FieldMany2One(self,
                        'product_filter_model_id',
                        self.O4FWidgetModel.get(recordID),
                        {mode: 'edit'}
                    )
                };
                self.fields.product_filter_model_id.appendTo(self.$('.product_id_field'));
            });
        },
        _changeProductPrice: function () {
            var self = this;
            if (self.O4FWidgetModel.state != 'edit') {
                return;
            }
            if (event) {
                event.preventDefault();
            }
            var record = this.getParent();
            while (record && (!record.saveRecord)) {
                record = record.getParent();
            }
            var model_element = $(event.target);
            var product_id = self._getIDFromClass($(model_element)[0], 'product-');
            var model_element = $(event.target).closest('.oe_model_row');
            var model_id = self._getIDFromClass($(model_element).find("input[name='model-comment']")[0], 'modelbar-');

            _.each(self.O4FWidgetModel.models, function (v_measurebar, k_measurebar) {
                if (v_measurebar.order_model_id == model_id) {
                    _.each(v_measurebar.products, function (v_productbar, k_productbar) {
                        if (v_productbar != 0) {
                            _.each(v_productbar, function (v_productline) {
                                if (v_productline != 0) {
                                    if (v_productline.line.product_id == product_id) {
                                        v_productline.line.price_unit = parseFloat(event.target.value);
                                        event.target.value = self.formatValues(parseFloat(event.target.value));
                                        v_measurebar.has_changes = true;
                                        $(event.target).replaceWith("<span class='product_price product-" + product_id + "'>" + event.target.value + "</span>");
                                        self.saveOrderLine(record, v_productline, v_measurebar.order_model_id, v_measurebar.has_changes, ['price_unit']);

                                    }

                                }
                            });

                        }
                    });
                }

            });

        },
        _changeModelComment: function (event) {
            var self = this;
            self.O4FWidgetModel.saveState = true;
            if (event) {
                event.preventDefault();
            }
            var record = this.getParent();
            while (record && (!record.saveRecord)) {
                record = record.getParent();
            }
            var model_element = $(event.target).closest('.oe_model_row');
            var model_id = self._getIDFromClass($(model_element).find("input[name='model-comment']")[0], 'modelbar-');
            var model_size = 0;
            for (var i = 0; i < self.O4FWidgetModel.models.length; i++) {
                if (self.O4FWidgetModel.models[i].order_model_id == model_id) {
                    for (var j = 0; j < self.O4FWidgetModel.models[i].products.length; j++) {
                        model_size += self.O4FWidgetModel.models[i].products[j].length
                    }
                }
            }
            var enableControls = _.after(model_size, function () {
                self.O4FWidgetModel.saveState = false;
            });
            _.each(self.O4FWidgetModel.models, function (v_measurebar, k_measurebar) {
                if (v_measurebar.order_model_id == model_id) {
                    v_measurebar.comment = event.target.value;
                    _.each(v_measurebar.products, function (v_productbar, k_productbar) {
                        if (v_productbar != 0) {
                            _.each(v_productbar, function (v_productline) {
                                if (v_productline != 0) {
                                    v_productline.line.order_note = event.target.value || '';
                                    v_measurebar.has_changes = true;
                                    self.saveOrderLine(record, v_productline, v_measurebar.order_model_id, v_measurebar.has_changes, ['order_note']);
                                    enableControls();
                                }
                            });
                        }
                    });
                }

            });
            //
        },
        _changeModelDiscount: function (event) {
            var self = this;
            self.O4FWidgetModel.saveState = true;
            if (event) {
                event.preventDefault();
            }
            var record = this.getParent();
            while (record && (!record.saveRecord)) {
                record = record.getParent();
            }
            var model_element = $(event.target).closest('.oe_model_row');
            var model_id = self._getIDFromClass($(model_element).find("input[name='model-comment']")[0], 'modelbar-');
            var model_size = 0;
            for (var i = 0; i < self.O4FWidgetModel.models.length; i++) {
                if (self.O4FWidgetModel.models[i].order_model_id == model_id) {
                    for (var j = 0; j < self.O4FWidgetModel.models[i].products.length; j++) {
                        model_size += self.O4FWidgetModel.models[i].products[j].length
                    }
                }
            }
            var enableControls = _.after(model_size, function () {
                self.O4FWidgetModel.saveState = false;
            });
            _.each(self.O4FWidgetModel.models, function (v_measurebar, k_measurebar) {
                if (v_measurebar.order_model_id == model_id) {
                    v_measurebar.discount = event.target.value;
                    _.each(v_measurebar.products, function (v_productbar, k_productbar) {
                        if (v_productbar != 0) {
                            _.each(v_productbar, function (v_productline) {
                                if (v_productline != 0) {
                                    v_productline.line.discount = event.target.value;
                                    v_measurebar.has_changes = true;
                                    self.saveOrderLine(record, v_productline, v_measurebar.order_model_id, v_measurebar.has_changes, ['discount']).then(function () {
                                        enableControls();
                                    });

                                }
                            });
                        }
                    });
                }
            });
        },
        _changeProductQty: function (event) {
            var self = this;
            if (event) {
                event.preventDefault();
            }
            var record = this.getParent();
            while (record && (!record.saveRecord)) {
                record = record.getParent();
            }
            var model_element = $(event.target);
            var product_id = self._getIDFromClass($(model_element)[0], 'product-');
            var model_element = $(event.target).closest('.oe_model_row');
            var model_id = self._getIDFromClass($(model_element).find("input[name='model-comment']")[0], 'modelbar-');

            _.each(self.O4FWidgetModel.models, function (v_measurebar, k_measurebar) {
                if (v_measurebar.order_model_id == model_id) {
                    _.each(v_measurebar.products, function (v_productbar, k_productbar) {
                        if (v_productbar != 0) {
                            _.each(v_productbar, function (v_productline) {
                                if (v_productline != 0) {
                                    if (v_productline.line.product_id == product_id) {
                                        v_productline.line[self.O4FWidgetModel.common_quantity_name] = parseFloat(event.target.value);
                                        v_productline.data.quantity = parseFloat(event.target.value);

                                        v_measurebar.has_changes = true;
                                        self.saveOrderLine(record, v_productline, v_measurebar.order_model_id, v_measurebar.has_changes, [self.O4FWidgetModel.common_quantity_name, 'price_unit']);
                                    }
                                }
                            });

                        }
                    });
                }

            });
        },
        _addModelBar: function (event) {
            var self = this;
            var record = this.getParent();
            while (record && (!record.saveRecord)) {
                record = record.getParent();
            }
            var partner_id = this._getParentField(self.O4FWidgetModel.model_partner_id_name);
            if (!partner_id.value.data.id) {
                alert(_("Partner not set"));
                return;
            }
            if (!this.fields.product_filter_model_id.value || !this.fields.product_filter_model_id.value.data) {
                return
            }
            var model_fields = [];
            model_fields.push(partner_id.value.data.id);
            if (self.O4FWidgetModel.model_pricelist_id_name != 'no') {
                model_fields.push(this._getParentField(self.O4FWidgetModel.model_pricelist_id_name).value.data.id);
            } else {
                model_fields.push(self.O4FWidgetModel.default_pricelist_id)
            }
            model_fields.push(this._getParentField(self.O4FWidgetModel.model_date_order_name).value.format('L'));
            model_fields.push(this._getParentField(self.O4FWidgetModel.model_fiscal_position_id_name).value.data.id);
            model_fields.push(this._getParentField(self.O4FWidgetModel.model_state_name).value);
            model_fields.push(this.fields.product_filter_model_id.value.data.id);
            if (self.O4FWidgetModel.model_warehouse_name != 'no') {
                model_fields.push(this._getParentField(self.O4FWidgetModel.model_warehouse_name).value.data.id);
            } else {
                model_fields.push(self.O4FWidgetModel.default_warehouse_id)
            }
            if (self.O4FWidgetModel.model_doc_type_name != 'no') {
                model_fields.push({'type': this._getParentField(self.O4FWidgetModel.model_doc_type_name).value})
            }
            this.O4FWidgetModel.fetchModel(this.model.model, model_fields).then(function (model) {

                var order_model_id = self._idGenerator();
                model.order_model_id = order_model_id;
                var line;

                var model_size = 0;

                for (var i = 0; i < model.products.length; i++) {
                    model_size += model.products[i].length
                }


                var enableControls = _.after(model_size, function () {
                    self.$el.html(QWeb.render("O4FWidget", {widget: self.O4FWidgetModel}));
                    self._makeModelRecord(undefined, undefined).then(function (recordID) {
                        self.fields.product_filter_model_id.reset(self.O4FWidgetModel.get(recordID));
                        self.fields = {
                            product_filter_model_id: new relational_fields.FieldMany2One(self,
                                'product_filter_model_id',
                                self.O4FWidgetModel.get(recordID),
                                {mode: 'edit'}
                            )
                        };
                        self.fields.product_filter_model_id.appendTo(self.$('.product_id_field'));
                    });
                });
                _.each(model.products, function (v_productbar, k_productbar) {
                    if (v_productbar != 0) {
                        _.each(v_productbar, function (v_productline) {
                            if (v_productline != 0) {
                                line = self.createOrderLine(record, v_productline, order_model_id);
                                record.model.notifyChanges(record.handle, line, {notifyChange: false}).then(function (result) {
                                    enableControls();
                                });
                            } else {
                                enableControls();
                            }
                        });

                    } else {
                        enableControls();
                    }
                });


            });

        },
        _onFieldChanged: function (event) {
            event.stopPropagation();
            var fieldName = event.target.name;
            var self = this;
            var product_filter_model_id = {id: null, display_name: null};
            var product_attribute_size_id = {id: null, display_name: null};
            var product_attribute_color_id = {id: null, display_name: null};
            var product_collection_id = {id: null, display_name: null};
            var product_brand_id = {id: null, display_name: null};


            if (fieldName === 'product_filter_model_id') {
                product_filter_model_id = event.data.changes.product_filter_model_id;
                if (product_filter_model_id != undefined) {
                    this.fields.product_filter_model_id.value = [product_filter_model_id.id, product_filter_model_id.display_name];
                }
            }
            this._makeModelRecord(product_filter_model_id.id, product_filter_model_id.display_name).then(function (recordID) {
                if (fieldName === 'product_filter_model_id') {
                    self.fields.product_filter_model_id.reset(self.O4FWidgetModel.get(recordID));
                    //self.$el.attr('data-product_filter_model_id', product_filter_model_id);
                }

            });

            if (fieldName === 'product_attribute_size_id') {
                product_attribute_size_id = event.data.changes.product_attribute_size_id;
                if (product_attribute_size_id != undefined) {
                    this.fields.product_attribute_size_id.value = [product_attribute_size_id.id, product_attribute_size_id.display_name];
                }
            }
            if (fieldName === 'product_attribute_color_id') {
                product_attribute_color_id = event.data.changes.product_attribute_color_id;
                if (product_attribute_color_id != undefined) {
                    this.fields.product_attribute_color_id.value = [product_attribute_color_id.id, product_attribute_color_id.display_name];
                }
            }
            this._makeAttributeSizeRecord(product_attribute_size_id.id, product_attribute_size_id.display_name).then(function (recordID) {
                if (fieldName == 'product_attribute_size_id') {
                    self.fields.product_attribute_size_id.reset(self.O4FWidgetModel.get(recordID));
                    //self.$el.attr('data-product_attribute_size_id', product_attribute_size_id);
                }
            });
            this._makeAttributeColorRecord(product_attribute_color_id.id, product_attribute_color_id.display_name).then(function (recordID) {
                if (fieldName == 'product_attribute_color_id') {
                    self.fields.product_attribute_color_id.reset(self.O4FWidgetModel.get(recordID));
                    //self.$el.attr('data-product_attribute_color_id', product_attribute_color_id);
                }
            });

            if (fieldName === 'product_collection_id') {
                product_collection_id = event.data.changes.product_collection_id;
                if (product_collection_id != undefined) {
                    this.fields.product_collection_id.value = [product_collection_id.id, product_collection_id.display_name];
                }
            }
            this._makeCollectionRecord(product_collection_id.id, product_collection_id.display_name).then(function (recordID) {
                if (fieldName == 'product_collection_id') {
                    self.fields.product_collection_id.reset(self.O4FWidgetModel.get(recordID));
                    //self.$el.attr('data-product_collection_id', product_collection_id);
                }
            });

            if (fieldName === 'product_brand_id') {
                product_brand_id = event.data.changes.product_brand_id;
                if (product_brand_id != undefined) {
                    this.fields.product_brand_id.value = [product_brand_id.id, product_brand_id.display_name];
                }
            }
            this._makeBrandRecord(product_brand_id.id, product_brand_id.display_name).then(function (recordID) {
                if (fieldName == 'product_brand_id') {
                    self.fields.product_brand_id.reset(self.O4FWidgetModel.get(recordID));
                    //self.$el.attr('data-product_brand_id', product_brand_id);
                }
            });

        },
        _makeCollectionRecord: function (collection_id, collection_name) {
            var field = {
                relation: 'product.collection',
                type: 'many2one',
                name: 'product_collection_id',
                attr: {
                    can_write: true,
                }
            };
            if (collection_id) {
                field.value = [collection_id, collection_name];
            }
            return this.O4FWidgetModel.makeRecord('product.collection', [field], {
                product_collection_id: {
                    options: {
                        no_create: true,

                    }
                }
            });
        },
        _makeBrandRecord: function (brand_id, brand_name) {
            var field = {
                relation: 'product.brand',
                type: 'many2one',
                name: 'product_brand_id',
                attr: {
                    can_write: true,
                }
            };
            if (brand_id) {
                field.value = [brand_id, brand_name];
            }
            return this.O4FWidgetModel.makeRecord('product.brand', [field], {
                product_brand_id: {
                    options: {
                        no_create: true,

                    }
                }
            });
        },
        _makeAttributeRecord: function (attribute_id, attribute_name) {
            var field = {
                relation: 'product.attribute',
                type: 'many2one',
                name: 'product_attribute_id',
                attr: {
                    can_write: true,
                }
            };
            if (attribute_id) {
                field.value = [attribute_id, attribute_name];
            }
            return this.O4FWidgetModel.makeRecord('product.attribute', [field], {
                product_filter_model_id: {
                    options: {
                        no_create: true,

                    }
                }
            });
        },
        _makeAttributeSizeRecord: function (attribute_id, attribute_name) {
            var field = {
                relation: 'product.attribute',
                type: 'many2one',
                name: 'product_attribute_size_id',
                domain: [['attribute_type', '=', 'size']],
                attr: {
                    can_write: true,
                }
            };
            if (attribute_id) {
                field.value = [attribute_id, attribute_name];
            }
            return this.O4FWidgetModel.makeRecord('product.attribute', [field], {
                product_attribute_size_id: {
                    options: {
                        no_create: true,

                    }
                }
            });
        },
        _makeAttributeColorRecord: function (attribute_id, attribute_name) {
            var field = {
                relation: 'product.attribute',
                type: 'many2one',
                name: 'product_attribute_color_id',
                domain: [['attribute_type', '=', 'color']],
                attr: {
                    can_write: true,
                }
            };
            if (attribute_id) {
                field.value = [attribute_id, attribute_name];
            }
            return this.O4FWidgetModel.makeRecord('product.attribute', [field], {
                product_attribute_color_id: {
                    options: {
                        no_create: true,

                    }
                }
            });
        },
        _makeModelRecord: function (product_id, product_name) {
            var self = this;
            var field = {
                relation: 'product.template',
                type: 'many2one',
                name: 'product_filter_model_id',
                domain: [],
                attr: {
                    can_write: true,
                }
            };
            if (product_id) {
                field.value = [product_id, product_name];
            }
            return this.O4FWidgetModel.makeRecord('product.template', [field], {
                product_filter_model_id: {
                    options: {
                        no_create: true,
                        no_open: true,
                    }
                }
            });
        },
        _getIDFromClass: function (element, class_prefix) {
            if (element == undefined) {
                return;
            }
            var classList = element.className.split(/\s+/);
            for (var i = 0; i < classList.length; i++) {
                if (classList[i].match("^" + class_prefix)) {
                    return parseInt(classList[i].substr(classList[i].indexOf('-') + 1));
                }
            }
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
        _getVirtualLineID: function (record, id, row) {
            var self = this;
            var virtual_id, element;
            if (id != null || id != undefined) {
                for (element in record.model.localData) {
                    if (record.model.localData[element].model == self.O4FWidgetModel.common_lines_name) {
                        if (record.model.localData[element].data.id == id) {
                            virtual_id = record.model.localData[element].id;
                            break;

                        }
                    }

                }
            } else {
                for (element in record.model.localData) {
                    if (record.model.localData[element].model == self.O4FWidgetModel.common_lines_name) {
                        var product_id = "";
                        if (record.model.localData[element] != null) {
                            if (record.model.localData[element]._changes != null) {
                                if (record.model.localData[element]._changes.product_id != null) {
                                    product_id = record.model.localData[record.model.localData[element]._changes.product_id].res_id;
                                    if (product_id != "") {
                                        if (record.model.localData[element]._changes.order_model_id == row.line.order_model_id && product_id == row.line.product_id) {
                                            virtual_id = record.model.localData[element].id;
                                            break;
                                        }
                                    }
                                }
                            }

                        }
                    }
                }
            }
            return virtual_id;
        },
        _getParentField: function (field_name) {
            var self = this;
            //EC6 field => field_name == field.name

            var field_data = self.parent.allFieldWidgets[this.model.id].find((function (field) {
                    return field_name == field.name
                })
            );
            if (field_data != undefined) {
                if (field_data.value == false) {
                    field_data.value = {
                        'data': {
                            'value': false,
                            'id': false
                        }
                    }
                }
            } else {
                field_data = 1
            }

            return field_data;
        },
    });


    widget_registry.add('O4FWidget', O4FWidget);
});
