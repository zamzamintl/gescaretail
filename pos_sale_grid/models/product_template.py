# See LICENSE file for full copyright and licensing details.

from odoo import models, api, _


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    @api.multi
    def product_template_stock_grid(self):
        self.ensure_one()
        return {
            'name': _('Product Sale Grid'),
            'view_mode': 'pivot',
            'res_model': 'sale.grid.report',
            'type': 'ir.actions.act_window',
            'domain': [('product_tmpl_id', '=', self.id)],
        }
