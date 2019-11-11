odoo.define("pos_product_search_view.pos_product_search_view", function(require) {
    "use strict"

    var core = require('web.core');
    var DB = require('point_of_sale.DB');
    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');
    var session = require('web.session');

    var QWeb = core.qweb;
    var _t = core._t;

    var is_product_collections_install = _.contains(session.module_list, 'product_collections');
    var is_product_brand_install = _.contains(session.module_list, 'product_brand');
    var is_product_gender_install = _.contains(session.module_list, 'product_gender');

    var fields = ['name'];
    if(is_product_brand_install){
        fields.push('product_brand_id');
        models.load_models({
            model: 'product.brand',
            fields: ['name'],
            domain: null,
            loaded: function(self, brand){
                self.product_brand = brand;
                self.product_brand_list =  _.uniq(_.pluck(brand, 'name'));
            },
        });
    }
    if(is_product_collections_install){
        fields.push('collection_id');
        models.load_models({
            model: 'product.collection',
            fields: ['name'],
            domain: null,
            loaded: function(self, collection){
                self.product_collection_list =  _.uniq(_.pluck(collection, 'name'));
                self.product_collection = collection;
            },
        });
    }
    models.load_fields("product.product", fields);

    screens.ProductCategoriesWidget.include({
        init: function(parent, options){
            var self = this;
            this._super(parent,options);
            this.new_prod_list = self.pos.db.get_all_products_name();
            this.new_brand_list = self.pos.product_brand_list;
            this.new_collection_list = self.pos.product_collection_list;
            this.new_model_ref = self.pos.db.get_all_products_model_ref();
            this.new_varint_ref = self.pos.db.get_all_products_variant_ref();
            this.clear_product_search_handler = function(event){
                self.clear_product_search();
            };
            this.clear_brand_search_handler = function(event){
                self.clear_brand_search();
            };
            this.clear_collection_search_handler = function(event){
                self.clear_collection_search();
            };
            this.clear_gender_search_handler = function(event){
                self.clear_gender_search();
            };
            this.clear_model_ref_search_handler = function(event){
                self.clear_model_ref_search();
            };
            this.clear_variant_ref_search_handler = function(event){
                self.clear_variant_ref_search();
            };
            this.clear_all_search_handler = function(event){
                self.clear_all_search();
            }
        },
        get_all_product_filter_query: function(){
            var self = this;
            var query = {};
            var product_value = self.el.querySelector('#input_product_box') ? self.el.querySelector('#input_product_box').value : "";
            var brand_value = self.el.querySelector('#pos_brand_search input') ? self.el.querySelector('#pos_brand_search input').value : "";
            var collection_value = self.el.querySelector('#pos_collection_search input') ? self.el.querySelector('#pos_collection_search input').value : "";
            var gender_value = self.el.querySelector('#select_gender_box') ? self.el.querySelector('#select_gender_box').value : "";
            var model_ref_value = self.el.querySelector('#pos_model_code_search input') ? self.el.querySelector('#pos_model_code_search input').value : ""
            var model_varint_value = self.el.querySelector('#pos_varint_code_search input') ? self.el.querySelector('#pos_varint_code_search input').value : ""
            query['product'] = product_value;
            query['brand'] = brand_value;
            query['collection'] = collection_value;
            query['gender'] = gender_value;
            query['model_ref'] = model_ref_value;
            query['variant_ref'] = model_varint_value;
            
            return query;
        },
        perform_all_product_filter: function(search = false){
            var self = this;
            var query = {};
            var product_value = self.el.querySelector('#input_product_box') ? self.el.querySelector('#input_product_box').value : "";
            var brand_value = self.el.querySelector('#pos_brand_search input') ? self.el.querySelector('#pos_brand_search input').value : "";
            var collection_value = self.el.querySelector('#pos_collection_search input') ? self.el.querySelector('#pos_collection_search input').value : "";
            var gender_value = self.el.querySelector('#select_gender_box') ? self.el.querySelector('#select_gender_box').value : "";
            var model_ref_value = self.el.querySelector('#pos_model_code_search input') ? self.el.querySelector('#pos_model_code_search input').value : ""
            var model_varint_value = self.el.querySelector('#pos_varint_code_search input') ? self.el.querySelector('#pos_varint_code_search input').value : ""
            if(! search){
                query['product'] = product_value;
                query['brand'] = brand_value;
                query['collection'] = collection_value;
                query['gender'] = gender_value;
                query['model_ref'] = model_ref_value;
                query['variant_ref'] = model_varint_value;
                if(collection_value.length != 0 ||  brand_value.length != 0 || gender_value.length != 0 || product_value.length != 0
                        || model_ref_value.length > 0 || model_varint_value.length > 0){
               // if(collection_value.length != 0 ||  brand_value.length != 0 || gender_value.length != 0 || product_value.length != 0){
                    var category = self.pos.db.get_category_by_id(self.category.id);
                    self.pos.gui.screen_instances.products.product_categories_widget.perform_collection_search(category, query, false ,"");
                }else{
                    var products = this.pos.db.get_product_by_category(self.category.id);
                    if(products){
                        this.product_list_widget.set_product_list(products);
                    }
                }
            }
            if(brand_value.length == 0 && collection_value.length == 0 && product_value.length == 0 && gender_value.length == 0){
                if($('.pos_product_list_view').hasClass('active')){
                    $('.pos_product_list_view').trigger('click');
                }
            }
        },
        clear_product_search: function(){
            var self = this;
            var input = this.el.querySelector('#input_product_box');
                input.value = '';
            self.perform_all_product_filter();
            input.focus();
        },
        clear_brand_search: function(){
            var self = this;
            var input = this.el.querySelector('#pos_brand_search input');
                input.value = '';
            self.perform_all_product_filter();
            input.focus();
        },
        clear_collection_search: function(){
            var self = this;
            var input = this.el.querySelector('#pos_collection_search input');
                input.value = '';
            self.perform_all_product_filter();
            input.focus();
        },
        clear_gender_search: function(){
            var self = this;
            var input = this.el.querySelector('#select_gender_box');
                input.value = '';
            self.perform_all_product_filter();
            input.focus();
        },
        clear_model_ref_search: function(){
            var self = this;
            var input = this.el.querySelector('#pos_model_code_search input');
                input.value = '';
            self.perform_all_product_filter();
            input.focus();
        },
        clear_variant_ref_search: function(){
            var self = this;
            var input = this.el.querySelector('#pos_varint_code_search input');
                input.value = '';
            self.perform_all_product_filter();
            input.focus();
        },
        clear_all_search: function(){
            var self = this;
            var input_gender = this.el.querySelector('#select_gender_box');
                input_gender.value = '';
            var input_collection = this.el.querySelector('#input_collection_box');
                input_collection.value = '';
            var input_brand = this.el.querySelector('#input_brand_box');
                input_brand.value = '';
            var input_product = this.el.querySelector('#input_product_box');
                input_product.value = '';
            var input_varint = this.el.querySelector('#pos_varint_code_search input');
                input_varint.value = '';
            var input_model = this.el.querySelector('#pos_model_code_search input');
                input_model.value = '';
            var input = this.el.querySelector('.searchbox input');
                input.value = '';
            self.perform_all_product_filter();
        },
        check_perfom_search_query : function(category, query, buy_result){
            var self = this;
            var product_value = query['product'];
            var brand_value = query['brand'];
            var collection_value = query['collection'];
            var gender_value = query['gender'];
            var model_ref_value = query['model_ref'];
            var varint_ref_value = query['variant_ref'];
            if(product_value.length == 0 && brand_value.length == 0 && 
                collection_value.length == 0 && gender_value.length == 0
                && model_ref_value.length == 0 && varint_ref_value.length == 0){
//              if(product_value.length == 0 && brand_value.length == 0 && 
//                    collection_value.length == 0){
                var products = self.pos.db.get_product_by_category(category.id);
                self.product_list_widget.set_product_list(products);
                if($('.pos_product_list_view').hasClass('active')){
                    $('.pos_product_list_view').trigger('click');
                }
                return false;
            }
            return true;
        },
        perform_collection_search: function(category, query, buy_result){
            var products;
            if(query){
                if(this.check_perfom_search_query(category, query, buy_result)){
                    products = this.pos.db.search_collection_product_in_category(category.id,query);
                    
                    if(buy_result && products.length === 1){
                            this.pos.get_order().add_product(products[0]);
                            this.clear_collection_search();
                    }else{
                       this.product_list_widget.set_product_list(products);
                    }
                }
            }else{
                products = this.pos.db.get_product_by_category(this.category.id);
                this.product_list_widget.set_product_list(products);
            }
            if(!query){
                this.perform_all_product_filter(true);
            }
        },

        renderElement: function(){
            this._super()
            var self = this
            if(!is_product_collections_install){
                $("#pos_collection_search").hide();
            }
            if(!is_product_brand_install){
                $("#pos_brand_search").hide();
            }
            if(!is_product_gender_install){
                $("#pos_gender_search").hide();
            }
            if(true){
                $("#pos_model_code_search").hide();
                $("#pos_varint_code_search").hide();
            }
            /*Clear multiple search box event */
            this.el.querySelector('#pos_product_search .search-clear').addEventListener('click',this.clear_product_search_handler);
            this.el.querySelector('#pos_brand_search .search-clear').addEventListener('click',this.clear_brand_search_handler);
            this.el.querySelector('#pos_collection_search .search-clear').addEventListener('click',this.clear_collection_search_handler);
            this.el.querySelector('#pos_gender_search .search-clear').addEventListener('click',this.clear_gender_search_handler);
            this.el.querySelector('#pos_model_code_search .search-clear').addEventListener('click',this.clear_model_ref_search_handler);
            this.el.querySelector('#pos_varint_code_search .search-clear').addEventListener('click',this.clear_variant_ref_search_handler);
            this.el.querySelector('#button_clear_search').addEventListener('click',this.clear_all_search_handler);

            if(this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard){
                this.chrome.widget.keyboard.connect($(this.el.querySelector('#pos_product_search input')));
                this.chrome.widget.keyboard.connect($(this.el.querySelector('#pos_brand_search input')));
                this.chrome.widget.keyboard.connect($(this.el.querySelector('#pos_collection_search input')));
            }
            
            /*Autocomplete product search box*/
            var new_prod_list = self.new_prod_list;
            $('#input_product_box').autocomplete({
                source:new_prod_list,
                select: function(event, ui) {
                    if(ui){
                        var query = self.get_all_product_filter_query();
                        query['product'] = ui.item.value;
                        var category = self.pos.db.get_category_by_id(self.category.id);
                        self.pos.gui.screen_instances.products.product_categories_widget.perform_collection_search(category, query, false);
                    }
                },
            });
            $('#input_product_box').off('keyup').on('keyup',function(e){
                if(e.which === 13){
                    var query = self.get_all_product_filter_query();
                    query['product'] = this.value;
                    var category = self.pos.db.get_category_by_id(self.category.id);
                    self.pos.gui.screen_instances.products.product_categories_widget.perform_collection_search(category, query, false);
                }
                e.stopPropagation();
            })
                
            /*Autocomplete brand search box*/
            var new_brand_list = self.new_brand_list; 
            $('#input_brand_box').autocomplete({
                source:new_brand_list ? new_brand_list : [],
                select: function(event, ui) {
                    if(ui){
                        var query = self.get_all_product_filter_query();
                        query['brand'] = ui.item.value;
                        var category = self.pos.db.get_category_by_id(self.category.id);
                        self.pos.gui.screen_instances.products.product_categories_widget.perform_collection_search(category, query, false);
                    }
                },
            });
            $('#input_brand_box').off('keyup').on('keyup',function(e){
                if(e.which === 13){
                    var query = self.get_all_product_filter_query();
                    query['brand'] = this.value;
                    var category = self.pos.db.get_category_by_id(self.category.id);
                    self.pos.gui.screen_instances.products.product_categories_widget.perform_collection_search(category, query, false);
                }
                e.stopPropagation();
            });
            
            /*Autocomplete collection search box*/
            var new_collection_list = self.new_collection_list;
            $('#input_collection_box').autocomplete({
                source:new_collection_list ? new_collection_list : [],
                select: function(event, ui) {
                    if(ui){
                        var query = self.get_all_product_filter_query();
                        query['collection'] = ui.item.value;
                        var category = self.pos.db.get_category_by_id(self.category.id);
                        self.pos.gui.screen_instances.products.product_categories_widget.perform_collection_search(category, query, false);
                    }
                },
            });
            $('#input_collection_box').off('keyup').on('keyup',function(e){
                if(e.which === 13){
                    var query = self.get_all_product_filter_query();
                    query['collection'] = this.value;
                    var category = self.pos.db.get_category_by_id(self.category.id);
                    self.pos.gui.screen_instances.products.product_categories_widget.perform_collection_search(category, query, false);
                }
                e.stopPropagation();
            });
            
            /*Gender Selection Change Event*/
            $('#select_gender_box').on('change', function() {
                var query = self.get_all_product_filter_query();
                query['gender'] = this.value;
                var category = self.pos.db.get_category_by_id(self.category.id);
                self.pos.gui.screen_instances.products.product_categories_widget.perform_collection_search(category, query, false);
            });

            /*Model refernce search box*/
            var new_model_ref = self.new_model_ref;
            $('#input_model_code_box').autocomplete({
                source:new_model_ref ? new_model_ref : [],
                select: function(event, ui) {
                    if(ui){
                        var query = self.get_all_product_filter_query();
                        query['model_ref'] = ui.item.value;
                        var category = self.pos.db.get_category_by_id(self.category.id);
                        self.pos.gui.screen_instances.products.product_categories_widget.perform_collection_search(category, query, false);
                    }
                },
            });
            $('#input_model_code_box').off('keyup').on('keyup',function(e){
                if(e.which === 13){
                    var query = self.get_all_product_filter_query();
                    query['model_ref'] = this.value;
                    var category = self.pos.db.get_category_by_id(self.category.id);
                    self.pos.gui.screen_instances.products.product_categories_widget.perform_collection_search(category, query, false);
                }
                e.stopPropagation();
            })
            /*variant refernce search box*/
            var new_varint_ref = self.new_varint_ref;
            $('#input_varint_code_box').autocomplete({
                source:new_varint_ref ? new_varint_ref : [],
                select: function(event, ui) {
                    if(ui){
                        var query = self.get_all_product_filter_query();
                        query['variant_ref'] = ui.item.value;
                        var category = self.pos.db.get_category_by_id(self.category.id);
                        self.pos.gui.screen_instances.products.product_categories_widget.perform_collection_search(category, query, false);
                    }
                },
            });
            $('#input_varint_code_box').off('keyup').on('keyup',function(e){
                if(e.which === 13){
                    var query = self.get_all_product_filter_query();
                    query['variant_ref'] = this.value;
                    var category = self.pos.db.get_category_by_id(self.category.id);
                    self.pos.gui.screen_instances.products.product_categories_widget.perform_collection_search(category, query, false);
                }
                e.stopPropagation();
            })
            
        },
    });

    DB.include({
        init: function(options){
            this.product_by_brand = {};
            this.product_by_collection = {};
            this.product_by_gender = {};
            this.product_by_model_ref = {};
            this.product_by_variant_ref = {};
            this.product_by_name = {};
            this._super(options);
        },
        get_all_products_name: function(){
            return _.uniq(_.pluck(this.product_by_id,'name'));
        },
        get_all_products_model_ref: function(){
            return _.uniq(
                    _.filter(
                        _.pluck(this.product_by_id,'model_default_code'),
                        function(item) {return item;})
                    );
        },
        get_all_products_variant_ref: function(){
            return _.uniq(
                    _.filter(
                        _.pluck(this.product_by_id,'model_variant_code'),
                        function(item) {return item;})
                    );
        },
        add_products: function(products){
            var stored_categories = this.product_by_category_id;

            if(!products instanceof Array){
                products = [products];
            }
            for(var i = 0, len = products.length; i < len; i++){
                var product = products[i];
                var search_string = this._product_search_string(product);
                var categ_id = product.pos_categ_id ? product.pos_categ_id[0] : this.root_category_id;
                product.product_tmpl_id = product.product_tmpl_id[0];
                if(!stored_categories[categ_id]){
                    stored_categories[categ_id] = [];
                }
                stored_categories[categ_id].push(product.id);

                if(this.category_search_string[categ_id] === undefined){
                    this.category_search_string[categ_id] = '';
                }
                this.category_search_string[categ_id] += search_string;
                var ancestors = this.get_category_ancestors_ids(categ_id) || [];

                for(var j = 0, jlen = ancestors.length; j < jlen; j++){
                    var ancestor = ancestors[j];
                    if(! stored_categories[ancestor]){
                        stored_categories[ancestor] = [];
                    }
                    stored_categories[ancestor].push(product.id);

                    if( this.category_search_string[ancestor] === undefined){
                        this.category_search_string[ancestor] = '';
                    }
                    this.category_search_string[ancestor] += search_string; 
                }
                this.product_by_id[product.id] = product;
                if(product.product_brand_id && product.product_brand_id[1] && _.has(this.product_by_brand,product.product_brand_id[1])){
                    this.product_by_brand[product.product_brand_id[1]].push(product);
                }else{
                    if(product.product_brand_id && product.product_brand_id[1]){
                        this.product_by_brand[product.product_brand_id[1]] = [product];
                    }
                }
                if(product.collection_id && product.collection_id[1] && _.has(this.product_by_collection,product.collection_id[1])){
                    this.product_by_collection[product.collection_id[1]].push(product);
                }else{
                    if(product.collection_id && product.collection_id[1]){
                        this.product_by_collection[product.collection_id[1]] = [product];
                    }
                }
                if(product && product.gender && _.has(this.product_by_gender,product.gender)){
                    this.product_by_gender[product.gender].push(product);
                }else{
                    if(product && product.gender){
                        this.product_by_gender[product.gender] = [product];
                    }
                }
                if(product && product.model_ref && _.has(this.product_by_model_ref,product.model_ref)){
                    this.product_by_model_ref[product.model_ref].push(product);
                }else{
                    if(product && product.model_ref){
                        this.product_by_model_ref[product.model_ref] = [product];
                    }
                }
                if(product && product.variant_ref && _.has(this.product_by_variant_ref,product.variant_ref)){
                    this.product_by_variant_ref[product.variant_ref].push(product);
                }else{
                    if(product && product.variant_ref){
                        this.product_by_variant_ref[product.variant_ref] = [product];
                    }
                }
                if(product && product.name && _.has(this.product_by_name,product.name)){
                    this.product_by_name[product.name].push(product);
                }else{
                    if(product && product.name){
                        this.product_by_name[product.name] = [product];
                    }
                }
                if(product.barcode){
                    this.product_by_barcode[product.barcode] = product;
                }
            }
        },
        search_collection_product_in_category: function(category_id, query){
            var self = this;
            var limit = 1000;
            var product_collecttion_query = false;
            var product_brand_query = false;
            var product_gender_query = false;
            var product_query = false;
            var product_model_ref_query = false;
            var product_variant_ref_query = false;
            var results = [];
            if (query.product){
                product_query = query.product;
                if(self.product_by_name && self.product_by_name[product_query]){
                    if(results.length == 0){
                        results = self.product_by_name[product_query]
                    }else{
                        results = _.intersection(results, self.product_by_name[product_query]);
                    }
                }else{
                    return [];
                }
            }
            if (query.collection){
                product_collecttion_query = query.collection;
                if(self.product_by_collection && self.product_by_collection[product_collecttion_query]){
                    if(results.length == 0){
                        results = self.product_by_collection[product_collecttion_query]
                    }else{
                        results = _.intersection(results, self.product_by_collection[product_collecttion_query]);
                    }
                }else{
                    return [];
                }
            }
            if (query.brand){
                product_brand_query = query.brand;
                if(self.product_by_brand && self.product_by_brand[product_brand_query]){
                    if(results.length == 0){
                        results = self.product_by_brand[product_brand_query]
                    }else{
                        results = _.intersection(results, self.product_by_brand[product_brand_query]);
                    }
                }else{
                    return [];
                }
            }
            if (query.gender){
                product_gender_query = query.gender;
                if(self.product_by_gender && self.product_by_gender[product_gender_query]){
                    if(results.length == 0){
                        results = self.product_by_gender[product_gender_query]
                    }else{
                        results = _.intersection(results, self.product_by_gender[product_gender_query]);
                    }
                }else{
                    return [];
                }
            }
            if (query.model_ref){
                product_model_ref_query = query.model_ref;
                if(self.product_by_model_ref && self.product_by_model_ref[product_model_ref_query]){
                    if(results.length == 0){
                        results = self.product_by_model_ref[product_model_ref_query]
                    }else{
                        results = _.intersection(results, self.product_by_model_ref[product_model_ref_query]);
                    }
                }else{
                    return [];
                }
            }
            if (query.variant_ref){
                product_variant_ref_query = query.variant_ref;
                if(self.product_by_variant_ref && self.product_by_variant_ref[product_variant_ref_query]){
                    if(results.length == 0){
                        results = self.product_by_variant_ref[product_variant_ref_query]
                    }else{
                        results = _.intersection(results, self.product_by_variant_ref[product_variant_ref_query]);
                    }
                }else{
                    return [];
                }
            }
            results = results.slice(0, limit);
            return results;
        },
    })
});