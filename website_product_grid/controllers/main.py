from odoo import http
from odoo.http import request
from odoo.addons.website_sale.controllers.main import WebsiteSale

import logging
_logger = logging.getLogger(__name__)


class WebsiteSale(WebsiteSale):

    @http.route(['/shop/cart/update/multi/variant'], type='json',
                auth="public", methods=['POST'], website=True)
    def cart_update_multi_variant(self, data, **post):
        lookup_grid = {}
        for i in range(len(data)):
            self.cart_update(
                product_id=data[i]['product_id'],
                add_qty=data[i]['add_qty'],
            )
            if data[i]['product_id'] not in lookup_grid.keys():
                lookup_grid[data[i]['product_id']] = {
                    'qty_expected': data[i]['add_qty']
                }

        sale_order = request.website.sale_get_order(force_create=False)

        result_grid = None
        for line in sale_order.order_line:
            if not line.product_id:
                continue

            pop = lookup_grid.pop(line.product_id.id, None)
            if not pop:
                continue

            if line.warning_stock:
                pop.update({
                    'name': line.name,
                    'warning': line.warning_stock,
                })

                if not result_grid:
                    result_grid = []

                result_grid.append(pop)

        warning = None
        if len(lookup_grid.keys()) > 0:
            warning = "Some items couldn't be added to the cart"

        return {
            'cart_quantity': sale_order.cart_quantity,
            'redirect_url': '/shop/cart',
            'line_warnings': result_grid,
            'warnings': warning,
        }
