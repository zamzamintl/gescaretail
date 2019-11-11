odoo.define("pos_product_list_view.pos_product_list_view", function(require) {
    "use strict"

    var core = require('web.core');
    var models = require('point_of_sale.models');
    var rpc = require('web.rpc');
    var screens = require('point_of_sale.screens');
    var session = require('web.session');

    var QWeb = core.qweb;
    var _t = core._t;

    models.load_fields("product.product", ['name', 'color_attribute', 'color_attribute_id',
        'collection_id', 'product_brand_id', 'model_default_code', 'model_variant_code',
        'gender', 'size_attribute', 'size_attribute_id', 'qty_available', 'categ_id'
    ]);

    var is_pos_stock_grid_install = _.contains(session.module_list, 'pos_stock_grid');
    var is_product_sale_grid_install = _.contains(session.module_list, 'pos_sale_grid');
    var is_pos_stock_move_install = _.contains(session.module_list, 'pos_stock_move');
    var is_pos_product_template_view_install = _.contains(session.module_list, 'pos_product_template_view');
    var is_product_attribute_type_install = _.contains(session.module_list, 'product_attribute_type');
    var is_pos_product_list_install = _.contains(session.module_list, 'pos_product_list');

    screens.ProductCategoriesWidget.include({
        init: function(parent, options) {
            var self = this;
            this._super(parent, options);
            this.switch_list_view_handler = function(event) {
                $('.pos_product_kanban_view').removeClass('active');
                $(this).addClass('active');

                var brand_value = self.el.querySelector('#pos_brand_search input') ? self.el.querySelector('#pos_brand_search input').value : "";
                var collection_value = self.el.querySelector('#pos_collection_search input') ? self.el.querySelector('#pos_collection_search input').value : "";
                var gender_value = self.el.querySelector('#select_gender_box') ? self.el.querySelector('#select_gender_box').value : "";
                var product_value = self.el.querySelector('#input_product_box') ? self.el.querySelector('#input_product_box').value : "";
                var main_product_value = self.el.querySelector('.searchbox input') ? self.el.querySelector('.searchbox input').value : "";
                var model_ref_value = self.el.querySelector('#pos_model_code_search input') ? self.el.querySelector('#pos_model_code_search input').value : ""
                var model_varint_value = self.el.querySelector('#pos_varint_code_search input') ? self.el.querySelector('#pos_varint_code_search input').value : ""
                if (collection_value.length != 0 || brand_value.length != 0 || gender_value.length != 0 ||
                    main_product_value.length != 0 || product_value.length != 0 || model_ref_value.length != 0 ||
                    model_varint_value.length != 0) {
                    self.product_list_widget.renderElement({
                        empty_tree_view: false
                    });;
                } else {
                    self.product_list_widget.renderElement({
                        empty_tree_view: true
                    });
                }
            };
            this.switch_kanban_view_handler = function(event) {
                $('.pos_product_list_view').removeClass('active');
                $(this).addClass('active');
                self.product_list_widget.renderElement();
            };
        },
        renderElement: function() {
            this._super();
            this.el.querySelector('.pos_product_list_view').addEventListener('click', this.switch_list_view_handler);
            this.el.querySelector('.pos_product_kanban_view').addEventListener('click', this.switch_kanban_view_handler);
        },
        perform_all_product_filter_with_main: function() {
            var self = this;
            var query = {};
            var product_value = self.el.querySelector('#input_product_box') ? self.el.querySelector('#input_product_box').value : "";
            var brand_value = self.el.querySelector('#pos_brand_search input') ? self.el.querySelector('#pos_brand_search input').value : "";
            var collection_value = self.el.querySelector('#pos_collection_search input') ? self.el.querySelector('#pos_collection_search input').value : "";
            var gender_value = self.el.querySelector('#select_gender_box') ? self.el.querySelector('#select_gender_box').value : "";
            var main_product_value = self.el.querySelector('.searchbox input') ? self.el.querySelector('.searchbox input').value : "";
            var model_ref_value = self.el.querySelector('#pos_model_code_search input') ? self.el.querySelector('#pos_model_code_search input').value : ""
            var model_varint_value = self.el.querySelector('#pos_varint_code_search input') ? self.el.querySelector('#pos_varint_code_search input').value : ""
            if (brand_value.length == 0 && collection_value.length == 0 && product_value.length == 0 && gender_value.length == 0 &&
                main_product_value.length == 0 && model_ref_value && model_varint_value) {
                if ($('.pos_product_list_view').hasClass('active')) {
                    $('.pos_product_list_view').trigger('click');
                }
            }
        },
        clear_search: function() {
            this._super();
            var self = this;
            self.perform_all_product_filter_with_main();
        },
        perform_search: function(category, query, buy_result) {
            this._super(category, query, buy_result);
            if (!query) {
                var self = this;
                self.perform_all_product_filter_with_main();
            }
        },
    });

    screens.ProductListWidget.include({
        set_product_list: function(product_list) {
            this.product_list = product_list;
            var tree_view = $('.pos_product_list_view').hasClass('active');
            if (tree_view) {
                this.renderElement(tree_view);
            } else {
                this.renderElement();
            }
        },
        get_convert_value_to_int: function(value) {
            var tmp;
            do {
                tmp = value;
                value = value.replace(",", "");
            } while (tmp !== value);
            tmp = Number(value);
            return tmp;
        },
        renderElement: function(tree_view = false) {
            var self = this;
            var el_str = QWeb.render(this.template, {
                widget: this,
                tree_view: tree_view
            });
            var el_node = document.createElement('div');
            el_node.innerHTML = el_str;
            el_node = el_node.childNodes[1];

            if (this.el && this.el.parentNode) {
                this.el.parentNode.replaceChild(el_node, this.el);
            }
            this.el = el_node;

            var list_container = el_node.querySelector('.product-list');
            if (tree_view) {
                var empty_tree_view = tree_view['empty_tree_view'];
                if (empty_tree_view) {
                    $("#jqGrid").html("");
                    return;
                }
                list_container = el_node.querySelector('.table-product-list');
                var mydata = this.product_list;
                var pricelist = self.pos.get_order().pricelist
                _.each(mydata, function(data) {
                    if (is_pos_product_list_install && self.pos.config.iface_tax_included == 'total') {
                        data.tax_incl_price = self.pos.chrome.screens.products.product_list_widget.get_tax_incl_price(data, data.get_price(pricelist, 1))
                    } else {
                        data.tax_incl_price = data.get_price(pricelist, 1)
                    }
                })
                var grid = $("#jqGrid"),
                    getColumnIndexByName = function(grid, columnName) {
                        var cm = grid.jqGrid('getGridParam', 'colModel'),
                            i, l = cm.length;
                        for (i = 0; i < l; i++) {
                            if (cm[i].name === columnName) {
                                return i; // return the index
                            }
                        }
                        return -1;
                    };
                $('.product-list-scroller').addClass('hidden_scroll')
                var jgrid_height = $('.content-cell').height() - 40
                var jgrid_width = $('.content-cell').width() * 1.64
                $.jgrid.defaults.width = String(jgrid_width).split('.')[0];
                $.jgrid.defaults.responsive = true;
                $.jgrid.defaults.styleUI = 'Bootstrap';
                $("#jqGrid").html("");

                function formatterFunction(cellvalue, options, rowObject) {
                    if (cellvalue) {
                        if (typeof cellvalue == 'object' && cellvalue[1]) {
                            return cellvalue[1];
                        } else {
                            return cellvalue;
                        }
                    } else {
                        return "-";
                    }
                }

                function groupformatterFunction(cellvalue, options, rowObject) {
                    if (options.colModel.name == "color_attribute") {
                        if (cellvalue) {
                            return cellvalue;
                        } else {
                            return "No Color";
                        }
                    }
                    if (options.colModel.name == "pos_categ_id") {
                        return "No Color";
                    }
                    if (options.colModel.name == "uom_id") {
                        return "No Size";
                    }
                    if (options.colModel.name == "size_attribute") {
                        if (cellvalue) {
                            return cellvalue;
                        } else {
                            return "No Size";
                        }
                    }
                    return cellvalue;
                }

                function hasNumbers(t) {
                    return /\d/.test(t);
                }

                function sortcell(myCell, rowObj) {
                    var n = myCell.length;
                    var intRegex = /^\d+$/;
                    var checkNumeric;
                    checkNumeric = intRegex.test(myCell);
                    if (typeof myCell === "string") {
                        if (checkNumeric) {
                            return parseInt(myCell);
                        } else {
                            if (hasNumbers(myCell)) {
                                myCell.split("")
                                cell = ""
                                flag = true
                                _.each(myCell.split(""), function(res) {
                                    if (flag && hasNumbers(res)) {
                                        cell += res
                                    } else {
                                        flag = false
                                    }
                                })
                                return parseInt(cell);
                            } else {
                                return myCell;
                            }
                        }

                    } else {
                        return myCell;
                    }
                }
                var groupField = ['name', 'pos_categ_id', 'uom_id'];
                var colModel = [{
                    name: ' ',
                    index: 'act',
                    sortable: false,
                    formatter: 'actions',
                    formatoptions: {
                        editbutton: false,
                        delbutton: false,
                        keys: false
                    }
                }, {
                    label: 'Template ID',
                    name: 'product_tmpl_id',
                    formatter: 'number',
                    summaryType: 'min',
                    hidden: true
                }, {
                    label: 'Product ID',
                    name: 'id',
                    formatter: 'number',
                    summaryType: 'min',
                    hidden: true,
                    key: true,
                }, {
                    label: 'Total Stock',
                    name: 'qty_available',
                    formatter: 'number',
                    summaryType: 'min',
                    hidden: true
                }, {
                    label: 'Price',
                    name: 'tax_incl_price',
                    formatter: 'number',
                    summaryType: 'min',
                    hidden: true
                }, {
                    label: 'pos_categ_id',
                    name: 'pos_categ_id',
                    formatter: groupformatterFunction
                }, {
                    label: 'uom_id',
                    name: 'uom_id',
                    formatter: groupformatterFunction
                }, {
                    label: 'Name',
                    name: 'name',
                    formatter: formatterFunction
                }, {
                    label: 'Brand',
                    name: 'product_brand_id',
                    width: 50,
                    formatter: formatterFunction,
                    summaryType: function(value, name, record) {
                        return record.product_brand_id;
                    },
                }, {
                    label: 'Product Category',
                    name: 'categ_id',
                    width: 100,
                    formatter: formatterFunction,
                    summaryType: function(value, name, record) {
                        return record.categ_id;
                    },
                }, {
                    label: 'Collection',
                    name: 'collection_id',
                    width: 100,
                    formatter: formatterFunction,
                    summaryType: function(value, name, record) {
                        return record.collection_id;
                    },
                }, {
                    label: 'Gender',
                    name: 'gender',
                    width: 100,
                    formatter: formatterFunction,
                    summaryType: function(value, name, record) {
                        return record.gender;
                    },
                }]
                if (is_product_attribute_type_install) {
                    groupField = ["name", "color_attribute", "size_attribute"];
                    colModel = [{
                        name: ' ',
                        index: 'act',
                        sortable: false,
                        formatter: 'actions',
                        formatoptions: {
                            editbutton: false,
                            delbutton: false,
                            keys: false
                        }
                    }, {
                        label: 'Template ID',
                        name: 'product_tmpl_id',
                        formatter: 'number',
                        summaryType: 'min',
                        hidden: true
                    }, {
                        label: 'Product ID',
                        name: 'id',
                        formatter: 'number',
                        summaryType: 'min',
                        hidden: true,
                        key: true,
                    }, {
                        label: 'Total Stock',
                        name: 'qty_available',
                        formatter: 'number',
                        summaryType: 'min',
                        hidden: true
                    }, {
                        label: 'Price',
                        name: 'tax_incl_price',
                        formatter: 'number',
                        summaryType: 'min',
                        hidden: true
                    }, {
                        label: 'Color',
                        name: 'color_attribute',
                        formatter: groupformatterFunction
                    }, {
                        label: 'Size',
                        name: 'size_attribute',
                        formatter: groupformatterFunction,
                        sorttype: function(cell, obj) {
                            return sortcell(cell);
                        },
                    }, {
                        label: 'Name',
                        name: 'name',
                        formatter: formatterFunction
                    }, {
                        label: 'Brand',
                        name: 'product_brand_id',
                        width: 50,
                        formatter: formatterFunction,
                        summaryType: function(value, name, record) {
                            return record.product_brand_id;
                        },
                    }, {
                        label: 'Product Category',
                        name: 'categ_id',
                        width: 100,
                        formatter: formatterFunction,
                        summaryType: function(value, name, record) {
                            return record.categ_id;
                        },
                    }, {
                        label: 'Collection',
                        name: 'collection_id',
                        width: 100,
                        formatter: formatterFunction,
                        summaryType: function(value, name, record) {
                            return record.collection_id;
                        },
                    }, {
                        label: 'Gender',
                        name: 'gender',
                        width: 100,
                        formatter: formatterFunction,
                        summaryType: function(value, name, record) {
                            return record.gender;
                        },
                    }]
                }

                $("#jqGrid").jqGrid({
                    datatype: "local",
                    data: mydata,
                    colModel: colModel,
                    loadonce: true,
                    height: jgrid_height,
                    grouping: true,
                    scroll: true,
                    rowNum: mydata.length,
                    rownumbers: true,
                    groupingView: {
                        groupField: groupField,
                        groupColumnShow: [false, false, false],
                        groupText: ["<b>{0}</b>"],
                        groupOrder: ["asc"],
                        groupCollapse: true,
                        groupSummaryPos: ['header', 'header', 'header'],
                    },
                    onSelectRow: function(id, e) {
                        var product_id = $(".jqgrow.ui-row-ltr.active").find('td[aria-describedby="jqGrid_id"]').text().trim(" ");
                        if (product_id) {
                            product_id = self.get_convert_value_to_int(product_id);
                            var product = self.pos.db.get_product_by_id(product_id);
                            if (product.to_weight && self.pos.config.iface_electronic_scale) {
                                self.pos.gui.show_screen('scale', {
                                    product: product
                                });
                            } else {
                                self.pos.get_order().add_product(product);
                            }
                        }
                    },
                    loadComplete: function() {
                        $("#jqGrid").trigger('resize')
                        var iCol = getColumnIndexByName(grid, ' ');
                        //First Level Click Event
                        $(this).find(">tbody>tr.jqGridghead_0>td:nth-child(" + (iCol + 1) + ")").each(function() {
                            /*Blank Div For Icon Panel*/
                            $("<div>", {
                                    title: "Icon1",
                                }).css({
                                    cursor: "pointer",
                                    float: "left",
                                    "margin-left": "5px"
                                })
                                .appendTo($(this));


                            /*Icon1*/
                            $("<div>", {
                                    title: "Icon Stock Grid",
                                    click: function(e) {
                                        var template_id = $(e.target).closest("tr.jqGridghead_0").find('td[aria-describedby="jqGrid_product_tmpl_id"]').text().trim(" ")
                                        if (template_id) {
                                            template_id = self.get_convert_value_to_int(template_id);
                                            var prod = {
                                                'product_tmpl_id': template_id
                                            }
                                            if (is_pos_stock_grid_install) {
                                                self.pos.gui.show_popup('stock_grid_popup', {
                                                    'prod': prod
                                                });
                                            } else {
                                                self.pos.gui.show_popup('alert', {
                                                    title: _t('Warning'),
                                                    warning_icon: true,
                                                    body: _t("Please install pos stock grid module."),
                                                });
                                            }
                                        }
                                    }
                                }).css({
                                    "margin-left": "15px",
                                    cursor: "pointer",
                                    display: "inline-flex"
                                })
                                .addClass("fa fa-th")
                                .appendTo($(this));
                            /*Icon*/
                            $("<div>", {
                                    title: "Icon Sale Grid",
                                    click: function(e) {
                                        var template_id = $(e.target).closest("tr.jqGridghead_0").find('td[aria-describedby="jqGrid_product_tmpl_id"]').text().trim(" ")
                                        if (template_id) {
                                            template_id = self.get_convert_value_to_int(template_id);
                                            if (is_product_sale_grid_install) {
                                                var new_window = window.open("/web");
                                                rpc.query({
                                                    model: "product.template",
                                                    method: "product_template_stock_grid",
                                                    args: [template_id]
                                                }).then(function(res) {
                                                    res['views'] = [
                                                        [false, 'pivot']
                                                    ];
                                                    new_window['redirect_action'] = res;
                                                });
                                            } else {
                                                self.pos.gui.show_popup('alert', {
                                                    title: _t('Warning'),
                                                    warning_icon: true,
                                                    body: _t("Please install sale grid module."),
                                                });
                                            }
                                        }
                                    }
                                }).css({
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    "margin-left": "15px"
                                })
                                .addClass("fa fa-list")
                                .appendTo($(this));

                            /*Icon*/
                            $("<div>", {
                                    title: "Icon Traceability",
                                    click: function(e) {
                                        var template_id = $(e.target).closest("tr.jqGridghead_0").find('td[aria-describedby="jqGrid_product_tmpl_id"]').text().trim(" ")
                                        if (template_id) {
                                            template_id = self.get_convert_value_to_int(template_id);
                                            if (is_pos_stock_move_install) {
                                                var new_window = window.open("/web");
                                                rpc.query({
                                                    model: "product.template",
                                                    method: "action_stock_moves_views",
                                                    args: [template_id]
                                                }).then(function(res) {
                                                    _.each(res.views, function(view) {
                                                        if (view && view[1] == 'tree') {
                                                            view[1] = "list";
                                                        }
                                                    });
                                                    new_window['redirect_action'] = res;
                                                });
                                            } else {
                                                self.pos.gui.show_popup('alert', {
                                                    title: _t('Warning'),
                                                    warning_icon: true,
                                                    body: _t("Please install pos stock move module."),
                                                });
                                            }
                                        }
                                    }
                                }).css({
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    "margin-left": "15px"
                                })
                                .addClass("fa fa-angle-double-right")
                                .appendTo($(this));
                        });

                        $(this).find(">tbody>tr.jqGridghead_1").find('td[aria-describedby="jqGrid_product_brand_id"]').text("");
                        $(this).find(">tbody>tr.jqGridghead_1").find('td[aria-describedby="jqGrid_categ_id"]').text("");
                        $(this).find(">tbody>tr.jqGridghead_1").find('td[aria-describedby="jqGrid_collection_id"]').text("");
                        $(this).find(">tbody>tr.jqGridghead_1").find('td[aria-describedby="jqGrid_model_default_code"]').text("");
                        $(this).find(">tbody>tr.jqGridghead_1").find('td[aria-describedby="jqGrid_model_variant_code"]').text("");
                        $(this).find(">tbody>tr.jqGridghead_1").find('td[aria-describedby="jqGrid_gender"]').text("");
                        $(this).find(">tbody>tr.jqGridghead_2").find(".glyphicon.tree-wrap-ltr").remove();
                        //Third  Level Click Event
                        $(this).find(">tbody>tr.jqGridghead_2>td:nth-child(" + (iCol + 1) + ")").each(function() {
                            $(this).closest("tr.jqGridghead_2").find('td[aria-describedby="jqGrid_product_brand_id"]').text("");
                            $(this).closest("tr.jqGridghead_2").find('td[aria-describedby="jqGrid_categ_id"]').text("");
                            $(this).closest("tr.jqGridghead_2").find('td[aria-describedby="jqGrid_collection_id"]').text("");
                            $(this).closest("tr.jqGridghead_2").find('td[aria-describedby="jqGrid_model_default_code"]').text("");
                            $(this).closest("tr.jqGridghead_2").find('td[aria-describedby="jqGrid_model_variant_code"]').text("");
                            $(this).closest("tr.jqGridghead_2").find('td[aria-describedby="jqGrid_gender"]').text("");
                            var price = self.format_currency($(this).closest("tr.jqGridghead_2").find('td[aria-describedby="jqGrid_tax_incl_price"]').text().trim(" "))
                            $(this).closest("tr.jqGridghead_2").find('td[aria-describedby="jqGrid_product_brand_id"]').text(price);
                            /*Total Stock Div*/
                            //                            var stock = $(this).closest("tr.jqGridghead_2").find('td[aria-describedby="jqGrid_qty_available"]').text().trim(" ");
                            //                            $("<div>", {
                            //                                title: "Stock",
                            //                                text : "("+stock+")",
                            //                            }).css({cursor: "pointer",display: "inline-flex","margin-left": "5px"})
                            //                              .appendTo($(this));

                            /*Blank Div For Icon Panel*/
                            $("<div>", {
                                    title: "Icon Panel",
                                }).css({
                                    cursor: "pointer",
                                    float: "left",
                                    "margin-left": "5px"
                                })
                                .appendTo($(this));

                            /*Icon2*/
                            $("<div>", {
                                    title: "Icon Product Template",
                                    click: function(e) {
                                        var template_id = $(e.target).closest("tr.jqGridghead_2").find('td[aria-describedby="jqGrid_id"]').text().trim(" ")
                                        if (template_id) {
                                            template_id = self.get_convert_value_to_int(template_id);
                                            var prod = {
                                                'id': template_id
                                            }
                                            if (is_pos_product_template_view_install) {
                                                self.pos.gui.show_popup('product_template_view__popup', {
                                                    'prod': prod
                                                });
                                            } else {
                                                self.pos.gui.show_popup('alert', {
                                                    title: _t('Warning'),
                                                    warning_icon: true,
                                                    body: _t("Please install pos product template view module."),
                                                });
                                            }
                                        }
                                    }
                                }).css({
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    "margin-left": "15px"
                                })
                                .addClass("fa fa-info-circle")
                                .appendTo($(this));


                            /*Icon3*/
                            $("<div>", {
                                    title: "Icon Sale Grid",
                                    click: function(e) {
                                        var template_id = $(e.target).closest("tr.jqGridghead_2").find('td[aria-describedby="jqGrid_product_tmpl_id"]').text().trim(" ")
                                        if (template_id) {
                                            template_id = self.get_convert_value_to_int(template_id);
                                            if (is_product_sale_grid_install) {
                                                var new_window = window.open("/web");
                                                rpc.query({
                                                    model: "product.template",
                                                    method: "product_template_stock_grid",
                                                    args: [template_id]
                                                }).then(function(res) {
                                                    res['views'] = [
                                                        [false, 'pivot']
                                                    ];
                                                    new_window['redirect_action'] = res;
                                                });
                                            } else {
                                                self.pos.gui.show_popup('alert', {
                                                    title: _t('Warning'),
                                                    warning_icon: true,
                                                    body: _t("Please install sale grid module."),
                                                });
                                            }
                                        }
                                    }
                                }).css({
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    "margin-left": "15px"
                                })
                                .addClass("fa fa-list")
                                .appendTo($(this));

                            /*Icon4*/
                            $("<div>", {
                                    title: "Icon Traceability",
                                    click: function(e) {
                                        var template_id = $(e.target).closest("tr.jqGridghead_2").find('td[aria-describedby="jqGrid_product_tmpl_id"]').text().trim(" ")
                                        if (template_id) {
                                            template_id = self.get_convert_value_to_int(template_id);
                                            if (is_pos_stock_move_install) {
                                                var new_window = window.open("/web");
                                                rpc.query({
                                                    model: "product.template",
                                                    method: "action_view_stock_moves",
                                                    args: [template_id]
                                                }).then(function(res) {
                                                    _.each(res.views, function(view) {
                                                        if (view && view[1] == 'tree') {
                                                            view[1] = "list";
                                                        }
                                                    });
                                                    new_window['redirect_action'] = res;
                                                });
                                            } else {
                                                self.pos.gui.show_popup('alert', {
                                                    title: _t('Warning'),
                                                    warning_icon: true,
                                                    body: _t("Please install pos stock move module."),
                                                });
                                            }
                                        }
                                    }
                                }).css({
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    "margin-left": "15px"
                                })
                                .addClass("fa fa-angle-double-right")
                                .appendTo($(this));


                            /*Icon5*/
                            $("<div>", {
                                    title: "Add",
                                    text: 'ADD',
                                    click: function(e) {
                                        var product_id = $(e.target).closest("tr.jqGridghead_2").find('td[aria-describedby="jqGrid_id"]').text().trim(" ")
                                        if (product_id) {
                                            product_id = self.get_convert_value_to_int(product_id);
                                            var product = self.pos.db.get_product_by_id(product_id);
                                            if (product.to_weight && self.pos.config.iface_electronic_scale) {
                                                self.pos.gui.show_screen('scale', {
                                                    product: product
                                                });
                                            } else {
                                                self.pos.get_order().add_product(product);
                                            }
                                        }
                                    }
                                }).css({
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    "margin-left": "10px",
                                    "font-weight": 'bold'
                                })
                                .appendTo($(this));

                        });
                    }
                });
            } else {
                for (var i = 0, len = this.product_list.length; i < len; i++) {
                    var product_node = this.render_product(this.product_list[i], tree_view);
                    product_node.addEventListener('click', this.click_product_handler);
                    product_node.addEventListener('keypress', this.keypress_product_handler);
                    list_container.appendChild(product_node);
                }
            }
        },
    });

});