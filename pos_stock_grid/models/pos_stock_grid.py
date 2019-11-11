# See LICENSE file for full copyright and licensing details.

from odoo import models, api, _


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    @api.model
    def pos_get_grid_stock_locations(self, res_id):
        record = self.browse(res_id)
        try:
            if record:
                return record.product_stock_grid
            else:
                return _("<p>Failed to retrieve stock info</p>")
        except Exception:
            return _("<p>Failed to retrieve stock info</p>")
