# See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class ProductTemplateConditionalDiscount(models.Model):
    _name = 'product.template.conditional.discount'

    product_tmpl_id = fields.Many2one(
        comodel_name="product.template",
        string="Product"
    )
    discount = fields.Float()
    conditional_discount_id = fields.Many2one(
        comodel_name="product.conditional.discount"
    )
