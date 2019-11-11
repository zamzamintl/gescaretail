# See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class ProductConditionalStep(models.Model):
    _name = 'product.conditional.step'

    step_count = fields.Integer()
    step_discount = fields.Float()
    conditional_discount_id = fields.Many2one(
        comodel_name="product.conditional.discount",
    )
