odoo.define('website_product_grid.product_grid', function (require) {
    "use strict";
    var ajax = require('web.ajax');
    var core = require('web.core');
    var utils = require('web.utils');
    var _t = core._t;

    $(document).ready(function () {
        $('.oe_website_sale .a-submit, #comment .a-submit').off('click').on('click', function (event) {
            var data = [];
            if (!event.isDefaultPrevented() && !$(this).is(".disabled")) {
                var variant_element = document.getElementsByClassName('product-variant-input');
                if (variant_element != null) {
                    var variants = $('.product-variant-input')
                    variants.each(function(index, input){
                        var product_id = $(input).data('product-id')
                        var quantity = parseInt($(input).val())
                        if (isNaN(quantity) || quantity === 0) {
                            return
                        }
                        data.push({
                            product_id: product_id,
                            add_qty: quantity
                        })
                    })
                    if (data.length == 0) {
                        var $error_block = $('#multi-variant-error')
                        $error_block.show();
                        setTimeout(function () {
                            $error_block.fadeOut(600);
                        }, 3000);
                    }
                    else {
                        ajax.jsonRpc("/shop/cart/update/multi/variant", 'call',
                            {
                                'data': data,
                            })
                            .then(function (result) {
                                variants.each(function(index, input) {
                                    $(input).val(0)
                                })
                                // window.location.href = window.location.origin + result['redirect_url']
                                // $(window).location.reload(function () {
                                // });
                                var quantity = result['cart_quantity']
                                var $quantity = $(".my_cart_quantity");
                                $quantity.parent().parent().removeClass("d-none", !quantity);
                                $quantity.html(quantity).hide().fadeIn(600);

                                var line_warnings = result['line_warnings']
                                var warnings = result['warnings']

                                if (line_warnings || warnings) {
                                    var $warning_block = $('#multi-variant-warning')
                                    var $warning_block_html = $warning_block.children(":first")
                                    var result = ''

                                    if (warnings) {
                                        result += '<p class="mb0">' + warnings + '</p>'
                                    }

                                    if (line_warnings) {
                                        result += '<ul class="mb0">'
                                        for (var i = 0; i < line_warnings.length; i++) {
                                            result += '<li>' + line_warnings[i].name + ': ' + line_warnings[i].warning + '</li>'
                                        }
                                        result += '</ul>'
                                    }

                                    $warning_block_html.html(result)
                                    $warning_block.show();
                                    setTimeout(function () {
                                        $warning_block.fadeOut(600);
                                    }, 10000);
                                } else {
                                    var $info_block = $('#multi-variant-info')
                                    $info_block.show();
                                    setTimeout(function () {
                                        $info_block.fadeOut(600);
                                    }, 1000);
                                }
                            });
                    }
                }
                else {
                    $(this).closest('form').submit();
                }
            }
            if ($(this).hasClass('a-submit-disable')) {
                $(this).addClass("disabled");
            }
            if ($(this).hasClass('a-submit-loading')) {
                var loading = '<span class="fa fa-cog fa-spin"/>';
                var fa_span = $(this).find('span[class*="fa"]');
                if (fa_span.length) {
                    fa_span.replaceWith(loading);
                }
                else {
                    $(this).append(loading);
                }
            }
        });
    });

});
