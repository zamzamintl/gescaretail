# See LICENSE file for full copyright and licensing details.

from odoo import models, api


class ProductAttributeValue(models.Model):
    _inherit = 'product.attribute.value'

    @api.multi
    def name_get(self):
        if not self._context.get('show_attribute', True):
            return super(ProductAttributeValue, self).name_get()
        return [(value.id, value.name) for value in self]
