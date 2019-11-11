# -*- coding: utf-8 -*-

from odoo import models, fields, api


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    @api.multi
    def write(self, vals):
        res = super(ProductTemplate, self).write(vals)
        if vals.get('list_price'):
            if self.product_variant_count == 1:
                self.product_variant_id.write({
                    'list_price': vals.get('list_price'),
                    'lst_price': vals.get('list_price')
                })
        return res


class ProductProduct(models.Model):
    _inherit = 'product.product'

    lst_price = fields.Float(
        compute=False
    )
    list_price = fields.Float(
        compute=False
    )
